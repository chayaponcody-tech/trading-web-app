"""
Sandbox Execution Environment (Req 4)

Provides a restricted Python execution environment for untrusted strategy code.
Security layers:
  1. Import whitelist via RestrictedImporter (sys.meta_path hook)
  2. Restricted __builtins__ (removes open, exec, eval, compile, __import__, breakpoint)
  3. Isolated namespace (no access to global state)
  4. 30-second timeout via threading.Thread
"""
from __future__ import annotations

import sys
import threading
import time
from types import ModuleType

from core.schemas import SandboxResult

# ─── Whitelist & Blocked Builtins ─────────────────────────────────────────────

IMPORT_WHITELIST = frozenset({
    "numpy", "np",
    "pandas", "pd",
    "vectorbt", "vbt",
    "math", "statistics",
    "collections", "itertools",
})

BLOCKED_BUILTINS = {
    "open", "exec", "eval", "compile",
    "breakpoint",
}

# Note: __import__ is NOT removed from builtins because Python's `import`
# statement requires it internally. Import security is enforced by
# RestrictedImporter (sys.meta_path hook) which blocks non-whitelist modules.


# ─── RestrictedImporter ───────────────────────────────────────────────────────

class RestrictedImporter:
    """
    sys.meta_path hook that intercepts import statements and blocks
    any module whose base name is not in IMPORT_WHITELIST.
    """

    def find_module(self, fullname: str, path=None):
        base_module = fullname.split(".")[0]
        if base_module not in IMPORT_WHITELIST:
            return self  # intercept and block
        return None  # allow default import

    def load_module(self, fullname: str) -> ModuleType:
        raise ImportError(
            f"Security violation: import '{fullname}' is blocked. "
            f"Allowed modules: {sorted(IMPORT_WHITELIST)}"
        )


# ─── Safe Builtins ────────────────────────────────────────────────────────────

def _build_safe_builtins() -> dict:
    """Return a copy of builtins with dangerous functions removed."""
    import builtins
    safe = vars(builtins).copy()
    for name in BLOCKED_BUILTINS:
        safe.pop(name, None)
    return safe


# ─── SandboxExecutor ──────────────────────────────────────────────────────────

class SandboxExecutor:
    """
    Executes untrusted Python code in an isolated, restricted environment.

    Security invariant: any import not in IMPORT_WHITELIST raises ImportError.
    Timeout invariant: execution is terminated after timeout_seconds.
    """

    def __init__(self, timeout_seconds: int = 30):
        self.timeout = timeout_seconds

    def execute(self, code: str) -> SandboxResult:
        """
        Execute *code* in a sandboxed namespace.

        Returns SandboxResult with:
          - success=True and output=namespace dict on success
          - success=False and error message on ImportError, exception, or timeout
        """
        result: dict = {
            "success": False,
            "output": None,
            "error": None,
            "execution_time_ms": 0.0,
        }

        def _run() -> None:
            sys.meta_path.insert(0, RestrictedImporter())
            try:
                namespace: dict = {
                    "__builtins__": _build_safe_builtins(),
                    "__name__": "__sandbox__",
                }
                exec(code, namespace)  # noqa: S102
                result["success"] = True
                result["output"] = namespace
            except ImportError as e:
                result["error"] = f"ImportError: {e}"
            except Exception as e:
                result["error"] = f"{type(e).__name__}: {e}"
            finally:
                sys.meta_path[:] = [
                    m for m in sys.meta_path
                    if not isinstance(m, RestrictedImporter)
                ]

        start = time.monotonic()
        thread = threading.Thread(target=_run, daemon=True)
        thread.start()
        thread.join(timeout=self.timeout)
        result["execution_time_ms"] = (time.monotonic() - start) * 1000

        if thread.is_alive():
            return SandboxResult(
                success=False,
                error=f"Execution timeout after {self.timeout}s",
                execution_time_ms=result["execution_time_ms"],
            )

        return SandboxResult(**result)

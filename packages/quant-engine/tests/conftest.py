"""
conftest.py — add packages/quant-engine to sys.path so that
`from core.xxx import ...` works when pytest is run from the tests/ directory
or from the package root.
"""
import sys
from pathlib import Path

# Ensure the quant-engine package root is on sys.path
_pkg_root = Path(__file__).resolve().parent.parent
if str(_pkg_root) not in sys.path:
    sys.path.insert(0, str(_pkg_root))

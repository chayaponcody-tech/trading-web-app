"""
Alpha Agent — Alpha Generation + Mutation Pipeline (Req 3 & 9)

Responsibilities:
  - Generate Python strategy code via LLM (OpenRouterHTTPClient)
  - Validate syntax with ast.parse() and check for BaseStrategy subclass
  - Execute in SandboxExecutor
  - Self-correct on error (retry ≤ 5 times)
  - Mutate decayed strategies (termination: mutation_count ≤ 10 per lineage)
  - Register approved strategies to strategy-ai /strategy/register-dynamic
"""
from __future__ import annotations

import ast
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx

from core.sandbox_executor import SandboxExecutor
from core.schemas import GenerationResult, ValidationResult

# ─── Max Limits ───────────────────────────────────────────────────────────────

MAX_GENERATION_ATTEMPTS = 5
MAX_MUTATION_COUNT = 10


# ─── AlphaAgent ───────────────────────────────────────────────────────────────

class AlphaAgent:
    """
    Generates and mutates trading strategy code using an LLM.

    Parameters
    ----------
    llm_client:
        Duck-typed object with ``async def complete(prompt: str) -> str``.
    sandbox:
        SandboxExecutor instance for safe code execution.
    strategy_ai_url:
        Base URL of the strategy-ai service (e.g. "http://strategy-ai:8001").
    db:
        Open sqlite3.Connection to the shared trading_app.db.
    """

    def __init__(
        self,
        llm_client: Any,
        sandbox: SandboxExecutor,
        strategy_ai_url: str,
        db: sqlite3.Connection,
    ) -> None:
        self.llm_client = llm_client
        self.sandbox = sandbox
        self.strategy_ai_url = strategy_ai_url.rstrip("/")
        self.db = db

    # ─── Public API ───────────────────────────────────────────────────────────

    async def generate_strategy(
        self, topic: str, context: dict = {}
    ) -> GenerationResult:
        """
        Full generation pipeline: prompt → validate → sandbox → register.

        Retries up to MAX_GENERATION_ATTEMPTS (5) times.
        On each failure the stack trace is fed back to the LLM as a
        self-correction prompt.

        Returns GenerationResult with status "success" or "generation_failed".
        """
        lineage_id = str(uuid.uuid4())
        strategy_key = str(uuid.uuid4())

        prompt = self._build_generation_prompt(topic, context)
        last_error: str | None = None
        last_code: str = ""

        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            # Build prompt: first attempt uses generation prompt,
            # subsequent attempts use self-correction prompt.
            if attempt == 1:
                current_prompt = prompt
            else:
                current_prompt = self._build_self_correction_prompt(
                    last_code, last_error or "Unknown error"
                )

            code = await self.llm_client.complete(current_prompt)
            code = _extract_code_block(code)
            last_code = code

            # 1. Syntax + BaseStrategy check
            validation = self._validate_code(code)
            if not validation.valid:
                last_error = validation.error or "Validation failed"
                continue

            # 2. Sandbox execution
            sandbox_result = self.sandbox.execute(code)
            if not sandbox_result.success:
                last_error = sandbox_result.error or "Sandbox execution failed"
                continue

            # 3. Register strategy
            await self._register_strategy(strategy_key, code)

            return GenerationResult(
                strategy_key=strategy_key,
                python_code=code,
                attempts=attempt,
                status="success",
                lineage_id=lineage_id,
            )

        # All attempts exhausted
        return GenerationResult(
            strategy_key=strategy_key,
            python_code=last_code,
            attempts=MAX_GENERATION_ATTEMPTS,
            status="generation_failed",
            lineage_id=lineage_id,
        )

    async def mutate_strategy(
        self,
        original_code: str,
        metrics: dict,
        failure_reason: str,
        lineage_id: str,
    ) -> GenerationResult:
        """
        Mutation pipeline for a decayed/rejected strategy.

        Checks mutation_count for the lineage from mutation_history.
        If mutation_count >= MAX_MUTATION_COUNT (10), returns generation_failed
        immediately (termination invariant — Req 9.7).

        Otherwise calls LLM with mutation prompt and follows the same
        validate → sandbox → register pipeline.
        """
        mutation_count = self._get_mutation_count(lineage_id)
        if mutation_count >= MAX_MUTATION_COUNT:
            return GenerationResult(
                strategy_key=str(uuid.uuid4()),
                python_code=original_code,
                attempts=0,
                status="generation_failed",
                lineage_id=lineage_id,
            )

        child_key = str(uuid.uuid4())
        prompt = self._build_mutation_prompt(original_code, metrics, failure_reason)
        last_error: str | None = None
        last_code: str = original_code

        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            if attempt == 1:
                current_prompt = prompt
            else:
                current_prompt = self._build_self_correction_prompt(
                    last_code, last_error or "Unknown error"
                )

            code = await self.llm_client.complete(current_prompt)
            code = _extract_code_block(code)
            last_code = code

            validation = self._validate_code(code)
            if not validation.valid:
                last_error = validation.error or "Validation failed"
                continue

            sandbox_result = self.sandbox.execute(code)
            if not sandbox_result.success:
                last_error = sandbox_result.error or "Sandbox execution failed"
                continue

            # Record mutation in history
            self._record_mutation(
                lineage_id=lineage_id,
                parent_key="",  # caller may pass original key via metrics
                child_key=child_key,
                mutation_round=mutation_count + 1,
                failure_reason=failure_reason,
                decay_metrics=metrics,
            )

            await self._register_strategy(child_key, code)

            return GenerationResult(
                strategy_key=child_key,
                python_code=code,
                attempts=attempt,
                status="success",
                lineage_id=lineage_id,
            )

        return GenerationResult(
            strategy_key=child_key,
            python_code=last_code,
            attempts=MAX_GENERATION_ATTEMPTS,
            status="generation_failed",
            lineage_id=lineage_id,
        )

    # ─── Validation ───────────────────────────────────────────────────────────

    def _validate_code(self, code: str) -> ValidationResult:
        """
        1. Try ast.parse(code) — SyntaxError → ValidationResult(valid=False)
        2. Walk AST for ClassDef nodes whose bases include 'BaseStrategy'
        3. If none found → ValidationResult(valid=False, error="No BaseStrategy subclass found")
        4. Return ValidationResult(valid=True, class_name=<first match>)
        """
        try:
            tree = ast.parse(code)
        except SyntaxError as exc:
            return ValidationResult(valid=False, error=str(exc))

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                for base in node.bases:
                    base_name = _get_name(base)
                    if base_name == "BaseStrategy":
                        return ValidationResult(
                            valid=True, class_name=node.name
                        )

        return ValidationResult(
            valid=False, error="No BaseStrategy subclass found"
        )

    # ─── Prompt Builders ──────────────────────────────────────────────────────

    def _build_generation_prompt(self, topic: str, context: dict) -> str:
        """Build the initial strategy generation prompt."""
        context_str = json.dumps(context, ensure_ascii=False, indent=2) if context else "{}"
        return (
            f"You are an expert quantitative trading researcher.\n"
            f"Generate a Python trading strategy class based on the following research topic.\n\n"
            f"Research Topic: {topic}\n\n"
            f"Context:\n{context_str}\n\n"
            f"Requirements:\n"
            f"1. The class MUST extend BaseStrategy (already imported in scope).\n"
            f"2. Use only these imports: numpy, pandas, vectorbt, math, statistics, "
            f"collections, itertools.\n"
            f"3. Implement at minimum: __init__(self, params: dict) and "
            f"generate_signals(self, ohlcv: pd.DataFrame) -> pd.Series.\n"
            f"4. Return ONLY the Python code block, no explanations.\n\n"
            f"```python\n"
            f"# Your strategy code here\n"
            f"```"
        )

    def _build_mutation_prompt(
        self, original_code: str, metrics: dict, failure_reason: str
    ) -> str:
        """Build the mutation prompt with failure context."""
        metrics_str = json.dumps(metrics, ensure_ascii=False, indent=2)
        return (
            f"You are an expert quantitative trading researcher.\n"
            f"The following trading strategy has failed. Mutate it to improve performance.\n\n"
            f"Failure Reason: {failure_reason}\n\n"
            f"Performance Metrics:\n{metrics_str}\n\n"
            f"Original Strategy Code:\n```python\n{original_code}\n```\n\n"
            f"Requirements:\n"
            f"1. The mutated class MUST extend BaseStrategy.\n"
            f"2. Change at least ONE parameter or logic component from the original.\n"
            f"3. Use only these imports: numpy, pandas, vectorbt, math, statistics, "
            f"collections, itertools.\n"
            f"4. Return ONLY the Python code block, no explanations.\n\n"
            f"```python\n"
            f"# Your mutated strategy code here\n"
            f"```"
        )

    def _build_self_correction_prompt(self, code: str, error: str) -> str:
        """Build a self-correction prompt when the previous attempt failed."""
        return (
            f"You are an expert quantitative trading researcher.\n"
            f"The strategy code you generated has an error. Fix it.\n\n"
            f"Error:\n{error}\n\n"
            f"Failing Code:\n```python\n{code}\n```\n\n"
            f"Requirements:\n"
            f"1. The class MUST extend BaseStrategy.\n"
            f"2. Use only these imports: numpy, pandas, vectorbt, math, statistics, "
            f"collections, itertools.\n"
            f"3. Return ONLY the corrected Python code block, no explanations.\n\n"
            f"```python\n"
            f"# Your corrected strategy code here\n"
            f"```"
        )

    # ─── Strategy Registration ────────────────────────────────────────────────

    async def _register_strategy(self, key: str, code: str) -> bool:
        """
        POST /strategy/register-dynamic to strategy-ai service.
        Returns True on success, False on failure (non-fatal).
        """
        url = f"{self.strategy_ai_url}/strategy/register-dynamic"
        payload = {"strategy_key": key, "python_code": code}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)
                return response.status_code in (200, 201)
        except Exception:
            return False

    # ─── DB Helpers ───────────────────────────────────────────────────────────

    def _get_mutation_count(self, lineage_id: str) -> int:
        """Query mutation_history for the number of mutations in this lineage."""
        try:
            cursor = self.db.execute(
                "SELECT COUNT(*) FROM mutation_history WHERE lineage_id = ?",
                (lineage_id,),
            )
            row = cursor.fetchone()
            return row[0] if row else 0
        except sqlite3.Error:
            return 0

    def _record_mutation(
        self,
        lineage_id: str,
        parent_key: str,
        child_key: str,
        mutation_round: int,
        failure_reason: str,
        decay_metrics: dict,
    ) -> None:
        """Insert a row into mutation_history."""
        try:
            self.db.execute(
                """
                INSERT INTO mutation_history
                    (lineage_id, parent_key, child_key, mutation_round,
                     failure_reason, decay_metrics, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    lineage_id,
                    parent_key,
                    child_key,
                    mutation_round,
                    failure_reason,
                    json.dumps(decay_metrics),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            self.db.commit()
        except sqlite3.Error:
            pass  # non-fatal: mutation history is best-effort


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_name(node: ast.expr) -> str:
    """Extract a simple name string from an AST Name or Attribute node."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _extract_code_block(text: str) -> str:
    """
    Strip markdown code fences (```python ... ```) if present.
    Returns the raw code string.
    """
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # Drop first line (```python or ```) and last line (```)
        inner = lines[1:]
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        return "\n".join(inner).strip()
    return text

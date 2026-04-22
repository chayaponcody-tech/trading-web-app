"""
Evolutionary Loop Orchestration (Req 10)

Responsibilities:
  - Orchestrate the full Alpha → Backtest → Strategy_Manager pipeline
  - Wrap each agent call with asyncio timeout (60s default)
  - Track agent status: idle | running | error | timeout
  - Log errors with structured format: agent_name, timestamp, input_payload, error_type, cycle_id
  - run_decay_check: delegate to strategy_manager.check_alpha_decay()
  - get_status: return current status of all agents
"""
from __future__ import annotations

import asyncio
import logging
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from core.schemas import AgentStatus, CycleResult

logger = logging.getLogger(__name__)


@dataclass
class AgentRegistry:
    """Container for all agent instances used by EvolutionaryLoop."""
    alpha_agent: Any
    backtest_agent: Any
    strategy_manager: Any
    sentiment_agent: Any
    data_agent: Any
    scout_agent: Any


class EvolutionaryLoop:
    """
    Orchestrates the closed evolutionary loop across all agents.

    Parameters
    ----------
    agents:
        AgentRegistry (or dict-like) with alpha_agent, backtest_agent,
        strategy_manager, sentiment_agent, data_agent attributes.
    db:
        Open sqlite3.Connection to the shared trading_app.db.
    """

    def __init__(self, agents: AgentRegistry, db: sqlite3.Connection) -> None:
        self.alpha_agent = agents.alpha_agent
        self.backtest_agent = agents.backtest_agent
        self.strategy_manager = agents.strategy_manager
        self.sentiment_agent = agents.sentiment_agent
        self.data_agent = agents.data_agent
        self.scout_agent = agents.scout_agent
        self.db = db
        
        # New: Real-time event log buffer (last 50 events)
        self._logs: list[dict] = []

        # Initialise status for every agent
        self._agent_status: dict[str, AgentStatus] = {
            "alpha_agent": AgentStatus(name="alpha_agent", state="idle"),
            "backtest_agent": AgentStatus(name="backtest_agent", state="idle"),
            "strategy_manager": AgentStatus(name="strategy_manager", state="idle"),
            "sentiment_agent": AgentStatus(name="sentiment_agent", state="idle"),
            "data_agent": AgentStatus(name="data_agent", state="idle"),
            "scout_agent": AgentStatus(name="scout_agent", state="idle"),
        }
        
    def _add_log(self, message: str, level: str = "INFO"):
        """Add a timestamped log entry to the circular buffer."""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": message,
            "level": level
        }
        self._logs.insert(0, log_entry) # Most recent first
        if len(self._logs) > 50:
            self._logs.pop()
        logger.info(f"QuantLoop: {message}")

    # ------------------------------------------------------------------ #
    # Timeout wrapper                                                      #
    # ------------------------------------------------------------------ #

    async def _call_with_timeout(
        self,
        agent_name: str,
        coro: Any,
        timeout: int = 60,
    ) -> Any:
        """
        Await *coro* with a hard timeout.

        - Sets agent status to "running" before awaiting.
        - On asyncio.TimeoutError: sets status to "timeout", re-raises.
        - On any other exception: sets status to "error", re-raises.
        - On success: sets status to "idle".
        """
        now = datetime.now(timezone.utc).isoformat()
        self._agent_status[agent_name] = AgentStatus(
            name=agent_name,
            state="running",
            last_run=now,
        )

        try:
            result = await asyncio.wait_for(coro, timeout=timeout)
            self._agent_status[agent_name] = AgentStatus(
                name=agent_name,
                state="idle",
                last_run=now,
            )
            return result

        except asyncio.TimeoutError:
            self._agent_status[agent_name] = AgentStatus(
                name=agent_name,
                state="timeout",
                last_run=now,
                last_error=f"Timed out after {timeout}s",
            )
            raise

        except Exception as exc:
            self._agent_status[agent_name] = AgentStatus(
                name=agent_name,
                state="error",
                last_run=now,
                last_error=str(exc),
            )
            raise

    # ------------------------------------------------------------------ #
    # Generation cycle                                                     #
    # ------------------------------------------------------------------ #

    async def run_generation_cycle(self, topic: str) -> CycleResult:
        """
        Full pipeline: Alpha → Backtest → Strategy_Manager.

        1. alpha_agent.generate_strategy(topic)
        2. If success: backtest_agent.evaluate(strategy_key, python_code)
        3a. If approved: strategy_manager.register_approved(...)
        3b. If rejected: alpha_agent.mutate_strategy(...)

        Errors are logged with structured format:
            {agent_name, timestamp, input_payload, error_type, cycle_id}

        Returns CycleResult summarising the cycle.
        """
        cycle_id = str(uuid.uuid4())
        started_at = datetime.now(timezone.utc).isoformat()
        self._add_log(f"--- Starting Generation Cycle {cycle_id[:8]} ---")

        strategies_generated = 0
        strategies_approved = 0
        strategies_rejected = 0
        errors: list[dict] = []

        # ── Step 0: Scout for Alpha (Topic Discovery) ─────────────────────
        current_topic = topic
        if not current_topic or current_topic == "auto":
            try:
                self._add_log("ScoutAgent: Searching for new alpha ideas...")
                current_topic = await self._call_with_timeout(
                    "scout_agent",
                    self.scout_agent.scout_for_alpha(),
                    timeout=30,
                )
                self._add_log(f"ScoutAgent: Research topic found: '{current_topic}'")
            except Exception as exc:
                self._add_log(f"ScoutAgent failed, falling back to default topic.", "WARNING")
                current_topic = "trend following with volatility filter"

        # ── Step 1: Alpha generation ──────────────────────────────────────
        try:
            self._add_log(f"AlphaAgent: Generating Python code for topic '{current_topic[:30]}...'")
            generation_result = await self._call_with_timeout(
                "alpha_agent",
                self.alpha_agent.generate_strategy(current_topic),
                timeout=60,
            )
        except Exception as exc:
            self._add_log(f"AlphaAgent critical error: {exc}", "ERROR")
            errors.append(
                self._build_error_log(
                    agent_name="alpha_agent",
                    input_payload={"topic": current_topic},
                    error_type=type(exc).__name__,
                    cycle_id=cycle_id,
                )
            )
            return self._build_cycle_result(
                cycle_id, started_at,
                strategies_generated, strategies_approved,
                strategies_rejected, errors,
            )

        if generation_result.status != "success":
            self._add_log(f"AlphaAgent failed to generate code. Status: {generation_result.status}", "WARNING")
            return self._build_cycle_result(
                cycle_id, started_at,
                strategies_generated, strategies_approved,
                strategies_rejected, errors,
            )

        self._add_log(f"AlphaAgent: Successfully generated strategy '{generation_result.strategy_key[:8]}'")
        strategies_generated += 1
        strategy_key = generation_result.strategy_key
        python_code = generation_result.python_code
        lineage_id = generation_result.lineage_id

        # ── Step 2: Backtest evaluation ───────────────────────────────────
        try:
            self._add_log(f"BacktestAgent: Evaluating strategy performance on historical data...")
            backtest_result = await self._call_with_timeout(
                "backtest_agent",
                self.backtest_agent.evaluate(strategy_key, python_code),
                timeout=60,
            )
            self._add_log(f"BacktestAgent: Result {'APPROVED' if backtest_result.approved else 'REJECTED'}")
        except Exception as exc:
            self._add_log(f"BacktestAgent error: {exc}", "ERROR")
            errors.append(
                self._build_error_log(
                    agent_name="backtest_agent",
                    input_payload={
                        "strategy_key": strategy_key,
                        "python_code_length": len(python_code),
                    },
                    error_type=type(exc).__name__,
                    cycle_id=cycle_id,
                )
            )
            return self._build_cycle_result(
                cycle_id, started_at,
                strategies_generated, strategies_approved,
                strategies_rejected, errors,
            )

        # ── Step 3a: Approved → register ─────────────────────────────────
        if backtest_result.approved:
            try:
                self._add_log(f"StrategyManager: Registering approved strategy '{strategy_key}'")
                await self._call_with_timeout(
                    "strategy_manager",
                    self.strategy_manager.register_approved(
                        strategy_key,
                        python_code,
                        backtest_result.metrics,
                    ),
                    timeout=60,
                )
                strategies_approved += 1
                self._add_log(f"StrategyManager: Registration complete.")
            except Exception as exc:
                self._add_log(f"StrategyManager registration failed: {exc}", "ERROR")
                errors.append(
                    self._build_error_log(
                        agent_name="strategy_manager",
                        input_payload={
                            "strategy_key": strategy_key,
                            "metrics": backtest_result.metrics,
                        },
                        error_type=type(exc).__name__,
                        cycle_id=cycle_id,
                    )
                )

        # ── Step 3b: Rejected → mutate ────────────────────────────────────
        else:
            strategies_rejected += 1
            rejection_reason = backtest_result.rejection_reason or "Backtest rejected"
            try:
                self._add_log(f"AlphaAgent: Attempting mutation due to: {rejection_reason[:50]}...")
                await self._call_with_timeout(
                    "alpha_agent",
                    self.alpha_agent.mutate_strategy(
                        python_code,
                        backtest_result.metrics,
                        rejection_reason,
                        lineage_id,
                    ),
                    timeout=60,
                )
                self._add_log("AlphaAgent: Mutation submitted to lineage.")
            except Exception as exc:
                self._add_log(f"AlphaAgent mutation failed: {exc}", "ERROR")
                errors.append(
                    self._build_error_log(
                        agent_name="alpha_agent",
                        input_payload={
                            "strategy_key": strategy_key,
                            "rejection_reason": rejection_reason,
                            "lineage_id": lineage_id,
                        },
                        error_type=type(exc).__name__,
                        cycle_id=cycle_id,
                    )
                )

        self._add_log(f"--- Cycle {cycle_id[:8]} Complete ---")
        return self._build_cycle_result(
            cycle_id, started_at,
            strategies_generated, strategies_approved,
            strategies_rejected, errors,
        )

    # ------------------------------------------------------------------ #
    # Decay check                                                          #
    # ------------------------------------------------------------------ #

    async def run_decay_check(self) -> list[str]:
        """
        Delegate alpha decay evaluation to strategy_manager.check_alpha_decay().

        Returns list of strategy_keys that were decayed.
        """
        return await self._call_with_timeout(
            "strategy_manager",
            self.strategy_manager.check_alpha_decay(),
            timeout=60,
        )

    # ------------------------------------------------------------------ #
    # Status                                                               #
    # ------------------------------------------------------------------ #

    def get_status(self) -> dict[str, AgentStatus]:
        """Return current status of all agents."""
        return dict(self._agent_status)

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_error_log(
        agent_name: str,
        input_payload: dict,
        error_type: str,
        cycle_id: str,
    ) -> dict:
        """Build a structured error log entry."""
        return {
            "agent_name": agent_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "input_payload": input_payload,
            "error_type": error_type,
            "cycle_id": cycle_id,
        }

    @staticmethod
    def _build_cycle_result(
        cycle_id: str,
        started_at: str,
        strategies_generated: int,
        strategies_approved: int,
        strategies_rejected: int,
        errors: list[dict],
    ) -> CycleResult:
        """Construct a CycleResult with the current timestamp as completed_at."""
        return CycleResult(
            cycle_id=cycle_id,
            started_at=started_at,
            completed_at=datetime.now(timezone.utc).isoformat(),
            strategies_generated=strategies_generated,
            strategies_approved=strategies_approved,
            strategies_rejected=strategies_rejected,
            errors=errors,
        )

    def get_logs(self) -> list[dict]:
        """Return the current log buffer."""
        return list(self._logs)

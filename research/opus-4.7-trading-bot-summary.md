# Opus 4.7 Trading Bot - Architecture & Strategy Guide

This document summarizes the "Opus 4.7 Trading Bot" blueprint, an autonomous, cloud-scheduled trading agent designed to run on top of Claude Code.

## 1. Core Philosophy
- **Stateless Runs:** Each execution is independent. Failures self-heal on the next tick.
- **Git as Memory:** Every piece of state (portfolio, logs, research) is a markdown file committed to Git. This provides free versioning, diffs, and a human-readable audit trail.
- **Hard Rules as Gates:** Strategy discipline is enforced programmatically before every order.
- **Claude is the Bot:** There is no separate long-running process. Every scheduled run is a fresh LLM invocation reading a well-defined prompt.

## 2. Trading Strategy (Swing Trading Stocks)
### Hard Rules (Non-negotiable)
- **Stocks Only:** No options or complex derivatives.
- **Position Limits:** Maximum 5-6 open positions at a time.
- **Risk per Position:** Maximum 20% of equity per position.
- **Activity Limit:** Maximum 3 new trades per week.
- **Capital Deployment:** Target 75-85% of capital deployed.
- **Trailing Stop:** 10% trailing stop (real GTC order, not mental).
- **Hard Stop:** Cut any losing position at -7% from entry.
- **Tightening Stops:** Tighten to 7% when up +15%, and to 5% when up +20%.

### The Buy-Side Gate
Before any buy order, checks must pass:
1. Total positions <= 6.
2. Total trades this week < 3.
3. Position cost <= 20% of equity.
4. Position cost <= available cash.
5. Pattern Day Trader (PDT) room available.
6. Specific catalyst documented in research log.

## 3. System Architecture
### Repository Layout
- `/routines`: Cloud routine prompts (cron jobs).
- `/scripts`: API wrappers (Bash scripts) for Alpaca, Perplexity, and ClickUp.
- `/memory`: Persistent state (Markdown files).
  - `TRADING-STRATEGY.md`: The rulebook.
  - `TRADE-LOG.md`: Every trade + daily EOD snapshot.
  - `RESEARCH-LOG.md`: Daily pre-market research entries.
  - `WEEKLY-REVIEW.md`: Weekly recaps and performance grades.
  - `PROJECT-CONTEXT.md`: Static background/mission.

### API Wrappers
The bot interacts with the world via standardized bash scripts:
- `alpaca.sh`: Account, positions, quotes, orders.
- `perplexity.sh`: Market research queries.
- `clickup.sh`: Chat notifications.

## 4. Workflows
### Daily Schedule
1. **Pre-market (6:00 AM):** Research catalysts, write trade ideas to `RESEARCH-LOG.md`.
2. **Market-open (8:30 AM):** Execute planned trades, set trailing stops.
3. **Midday (12:00 PM):** Scan positions, cut losers (-7%), tighten stops on winners.
4. **Daily Summary (3:00 PM):** Snapshot portfolio state, send chat recap.
5. **Weekly Review (Friday 4:00 PM):** Compute weekly stats, grade performance, update strategy if needed.

## 5. Persistence & Cloud Execution
- Runs in ephemeral containers (Claude Code Cloud Routines).
- **Critical Step:** Every run must `git commit` and `git push` before exiting to persist changes to the memory files.
- Uses environment variables for secrets; never uses `.env` in the cloud to avoid leaks.

---
*Source: Autotrade.pdf (Nate Herk / AI Automation Society)*

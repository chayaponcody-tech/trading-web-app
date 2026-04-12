"""
logger.py
Centralized structured logging for the Strategy AI service.

Usage:
    from logger import get_logger
    log = get_logger(__name__)
    log.info("message")
    log.warning("message")
    log.error("message")
"""

import logging
import sys
import os
from datetime import datetime, timezone


LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.environ.get("LOG_FORMAT", "text")  # "text" | "json"


class _ColorFormatter(logging.Formatter):
    """Colored text formatter for terminal output."""

    COLORS = {
        "DEBUG":    "\033[36m",   # cyan
        "INFO":     "\033[32m",   # green
        "WARNING":  "\033[33m",   # yellow
        "ERROR":    "\033[31m",   # red
        "CRITICAL": "\033[35m",   # magenta
    }
    RESET = "\033[0m"
    BOLD  = "\033[1m"

    ICONS = {
        "DEBUG":    "🔍",
        "INFO":     "ℹ️ ",
        "WARNING":  "⚠️ ",
        "ERROR":    "❌",
        "CRITICAL": "🔥",
    }

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        icon  = self.ICONS.get(record.levelname, "  ")
        ts    = datetime.now(timezone.utc).strftime("%H:%M:%S")
        name  = record.name.split(".")[-1]  # short module name

        msg = record.getMessage()
        if record.exc_info:
            msg += "\n" + self.formatException(record.exc_info)

        return (
            f"{color}{self.BOLD}[{ts}]{self.RESET} "
            f"{icon} {color}{record.levelname:<8}{self.RESET} "
            f"\033[90m[{name}]\033[0m {msg}"
        )


class _JsonFormatter(logging.Formatter):
    """JSON-lines formatter for log aggregation (e.g. CloudWatch, Datadog)."""

    def format(self, record: logging.LogRecord) -> str:
        import json
        payload = {
            "ts":      datetime.now(timezone.utc).isoformat(),
            "level":   record.levelname,
            "module":  record.name,
            "msg":     record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        # Attach any extra fields passed via log.info("msg", extra={...})
        for key, val in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
            ):
                payload[key] = val
        return json.dumps(payload, ensure_ascii=False)


def _build_handler() -> logging.Handler:
    handler = logging.StreamHandler(sys.stdout)
    if LOG_FORMAT == "json":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(_ColorFormatter())
    return handler


# Root handler — attach once
_handler = _build_handler()
_handler.setLevel(LOG_LEVEL)

# Silence noisy third-party loggers
for _noisy in ("uvicorn.access", "httpx", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)


def get_logger(name: str = "strategy-ai") -> logging.Logger:
    """Return a named logger wired to the shared handler."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.addHandler(_handler)
    logger.setLevel(LOG_LEVEL)
    logger.propagate = False
    return logger

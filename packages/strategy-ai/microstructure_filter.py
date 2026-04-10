"""
Microstructure Filter
─────────────────────
Rule-based gate using Funding Rate + Open Interest data.
Moved from JS BotManager._checkMicrostructure() to Python
so all signal analysis lives in one place.

Returns: MicrostructureResult with pass/block decision + reason.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class MicrostructureResult:
    passed: bool
    reason: str
    funding_rate: float = 0.0
    oi_change_pct: float = 0.0
    penalty: float = 0.0   # confidence penalty to apply if passed but borderline


def check(
    signal: str,
    funding_rate: Optional[float],
    oi_change_pct: Optional[float],
    funding_threshold: float = 0.0005,
) -> MicrostructureResult:
    """
    Rules:
      1. Funding > +threshold  → block LONG  (over-leveraged longs, reversal risk)
      2. Funding < -threshold  → block SHORT (short squeeze risk)
      3. OI dropped > 10%      → block both  (weak conviction, signal unreliable)
      4. OI dropped 5-10%      → pass but apply confidence penalty -0.10
    """
    funding = funding_rate if funding_rate is not None else 0.0
    oi_chg  = oi_change_pct if oi_change_pct is not None else 0.0

    # ── Rule 1 & 2: Funding Rate ──────────────────────────────────────────────
    if signal == "LONG" and funding > funding_threshold:
        return MicrostructureResult(
            passed=False,
            reason=f"Funding Rate สูง (+{funding * 100:.4f}%) — Long squeeze risk สูง",
            funding_rate=funding,
            oi_change_pct=oi_chg,
        )

    if signal == "SHORT" and funding < -funding_threshold:
        return MicrostructureResult(
            passed=False,
            reason=f"Funding Rate ติดลบมาก ({funding * 100:.4f}%) — Short squeeze risk สูง",
            funding_rate=funding,
            oi_change_pct=oi_chg,
        )

    # ── Rule 3: OI hard block ─────────────────────────────────────────────────
    if oi_chg < -10:
        return MicrostructureResult(
            passed=False,
            reason=f"OI ลดลง {oi_chg:.1f}% — แรงหนุนอ่อน signal ไม่น่าเชื่อถือ",
            funding_rate=funding,
            oi_change_pct=oi_chg,
        )

    # ── Rule 4: OI soft warning → confidence penalty ─────────────────────────
    penalty = 0.0
    reason_parts = []

    if -10 <= oi_chg < -5:
        penalty = 0.10
        reason_parts.append(f"OI ลดลง {oi_chg:.1f}% (soft warning)")

    if oi_chg > 5:
        reason_parts.append(f"OI +{oi_chg:.1f}% ยืนยันแรง")

    reason_parts.append(f"Funding {funding * 100:.4f}%")
    reason = " | ".join(reason_parts)

    return MicrostructureResult(
        passed=True,
        reason=reason,
        funding_rate=funding,
        oi_change_pct=oi_chg,
        penalty=penalty,
    )

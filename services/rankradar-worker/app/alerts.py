from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class AlertDecision:
    alert_type: str
    severity: str
    rank_change: int | None
    message: str


def detect_alert(previous_rank: Optional[int], current_rank: Optional[int]) -> AlertDecision | None:
    """Detect rank risk. Amazon rank numbers get worse as they increase."""
    if previous_rank is not None and current_rank is None:
        return AlertDecision("NEW_UNRANKED", "critical", None, "Keyword was ranked previously but is now unranked or missing.")

    if previous_rank is None or current_rank is None:
        return None

    movement = current_rank - previous_rank

    if previous_rank <= 16 and current_rank >= 17:
        return AlertDecision("LOST_PAGE_1", "critical", movement, "Keyword moved out of page-one visibility.")

    if previous_rank <= 10 and current_rank >= 11:
        return AlertDecision("LOST_TOP_10", "high", movement, "Keyword moved out of top 10.")

    if movement >= 10:
        return AlertDecision("CRITICAL_DROP", "critical", movement, "Keyword worsened by 10 or more positions.")

    if movement >= 5:
        return AlertDecision("MAJOR_DROP", "high", movement, "Keyword worsened by 5 or more positions.")

    if movement <= -5:
        return AlertDecision("RECOVERY", "positive", movement, "Keyword recovered by 5 or more positions.")

    return None


def rank_health(rank_change: int | None, current_rank: int | None, alert_type: str | None = None) -> str:
    if alert_type in {"LOST_PAGE_1", "NEW_UNRANKED", "CRITICAL_DROP"}:
        return "critical"
    if alert_type in {"LOST_TOP_10", "MAJOR_DROP"}:
        return "watch"
    if rank_change is not None and rank_change <= -5:
        return "improving"
    if current_rank is not None and current_rank <= 10:
        return "strong"
    return "stable"

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class AlertDecision:
    alert_type: str
    severity: str
    rank_change: int | None
    message: str


def detect_alert(
    previous_rank: Optional[int],
    current_rank: Optional[int],
    search_volume: int | None = None,
) -> AlertDecision | None:
    """Detect keyword-level rank events.

    Amazon rank numbers worsen (increase) as visibility drops.
    Returns a single AlertDecision (highest-priority event) or None.

    Priority order (highest first):
      Exit events (most specific, surface first):
        1. NEW_UNRANKED   – was ranked, now missing
        2. LOST_PAGE_1    – exits page 1 (rank 1–16 → 17+)
        3. LOST_TOP_50    – exits Top 50 (rank 1–50 → 51+)
        4. LOST_TOP_10    – exits Top 10 (rank 1–10 → 11+)
      Entry events (milestone reached):
        5. ENTERED_TOP_10 – enters Top 10 (rank 11+ → 1–10)
        6. ENTERED_TOP_50 – enters Top 50 (rank 51+ → 1–50)
      Drop magnitude (general, no exit):
        7. CRITICAL_DROP  – worsens by ≥ 10 positions
        8. MAJOR_DROP     – worsens by 5–9 positions
        9. MEDIUM_DROP    – moves from near-Top-10 (11–20) to weak (21–50)
       10. MILD_DECLINE   – lower-SV keyword loses any position
      Improvement (no entry milestone):
       11. LARGE_IMPROVEMENT – improves by ≥ 10 positions
       12. RECOVERY          – improves by ≥ 5 positions
    """
    # ── Missing rank ───────────────────────────────────────────────────────
    if previous_rank is not None and current_rank is None:
        return AlertDecision("NEW_UNRANKED", "critical", None,
                             "Keyword was ranked but is now unranked or missing.")

    if previous_rank is None or current_rank is None:
        return None

    movement = current_rank - previous_rank  # positive = worse, negative = better

    # ── Exit events ────────────────────────────────────────────────────────
    if previous_rank <= 16 and current_rank >= 17:
        return AlertDecision("LOST_PAGE_1", "critical", movement,
                             "Keyword moved out of page-one visibility.")

    if previous_rank <= 50 and current_rank > 50:
        return AlertDecision("LOST_TOP_50", "critical", movement,
                             "Keyword dropped out of Top 50.")

    if previous_rank <= 10 and current_rank >= 11:
        return AlertDecision("LOST_TOP_10", "high", movement,
                             "Keyword moved out of Top 10.")

    # ── Entry events (positive milestones) ─────────────────────────────────
    if previous_rank > 10 and current_rank <= 10:
        return AlertDecision("ENTERED_TOP_10", "positive", movement,
                             "Keyword entered the Top 10.")

    if previous_rank > 50 and current_rank <= 50:
        return AlertDecision("ENTERED_TOP_50", "positive", movement,
                             "Keyword entered the Top 50.")

    # ── Drop magnitude ─────────────────────────────────────────────────────
    if movement >= 10:
        return AlertDecision("CRITICAL_DROP", "critical", movement,
                             "Keyword worsened by 10 or more positions.")

    if movement >= 5:
        return AlertDecision("MAJOR_DROP", "high", movement,
                             "Keyword worsened by 5 or more positions.")

    if 11 <= previous_rank <= 20 and 21 <= current_rank <= 50 and movement > 0:
        return AlertDecision("MEDIUM_DROP", "medium", movement,
                             "Keyword dropped from near-Top-10 to weak visibility (11–20 → 21–50).")

    if movement > 0 and search_volume is not None and search_volume < 5_000:
        return AlertDecision("MILD_DECLINE", "medium", movement,
                             "Lower search-volume keyword lost positions.")

    # ── Improvement magnitude ──────────────────────────────────────────────
    if movement <= -10:
        return AlertDecision("LARGE_IMPROVEMENT", "positive", movement,
                             "Keyword improved by 10 or more positions.")

    if movement <= -5:
        return AlertDecision("RECOVERY", "positive", movement,
                             "Keyword recovered by 5 or more positions.")

    return None


def rank_health(rank_change: int | None, current_rank: int | None, alert_type: str | None = None) -> str:
    """Derive a health label for UI badge display."""
    if alert_type in {"LOST_PAGE_1", "NEW_UNRANKED", "CRITICAL_DROP", "LOST_TOP_50"}:
        return "critical"
    if alert_type in {"LOST_TOP_10", "MAJOR_DROP", "MEDIUM_DROP"}:
        return "watch"
    if alert_type in {"LARGE_IMPROVEMENT", "ENTERED_TOP_10", "ENTERED_TOP_50", "RECOVERY"}:
        return "improving"
    if rank_change is not None and rank_change <= -5:
        return "improving"
    if current_rank is not None and current_rank <= 10:
        return "strong"
    return "stable"

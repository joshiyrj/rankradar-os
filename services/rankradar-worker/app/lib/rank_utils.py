from __future__ import annotations

BUCKET_EXCELLENT = "excellent"
BUCKET_STRONG = "strong"
BUCKET_NEAR_TOP10 = "near_top10"
BUCKET_WEAK = "weak"
BUCKET_POOR = "poor"
BUCKET_NOT_RANKING = "not_ranking"


def rank_bucket(organic_rank: int | None) -> str:
    """Return the rank bucket name for an organic rank value.

    Bucket definitions (matching the context spec):
        1–3   → excellent
        4–10  → strong (Top 10)
        11–20 → near_top10
        21–50 → weak
        51+   → poor
        None  → not_ranking
    """
    if organic_rank is None:
        return BUCKET_NOT_RANKING
    if organic_rank <= 3:
        return BUCKET_EXCELLENT
    if organic_rank <= 10:
        return BUCKET_STRONG
    if organic_rank <= 20:
        return BUCKET_NEAR_TOP10
    if organic_rank <= 50:
        return BUCKET_WEAK
    return BUCKET_POOR


BUCKET_COLORS: dict[str, str] = {
    BUCKET_EXCELLENT:   "#16a34a",
    BUCKET_STRONG:      "#4ade80",
    BUCKET_NEAR_TOP10:  "#facc15",
    BUCKET_WEAK:        "#fb923c",
    BUCKET_POOR:        "#ef4444",
    BUCKET_NOT_RANKING: "#4b5563",
}

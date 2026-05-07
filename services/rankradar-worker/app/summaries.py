from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean
from typing import Iterable, Any


def calculate_rank_summary(records: Iterable[dict[str, Any]], alerts: Iterable[dict[str, Any]] = ()) -> dict[str, Any]:
    rows = list(records)
    alert_rows = list(alerts)
    changes = [r.get("rank_change") for r in rows if r.get("rank_change") is not None]
    improved = [r for r in rows if (r.get("rank_change") or 0) < 0]
    declined = [r for r in rows if (r.get("rank_change") or 0) > 0]
    stable = [r for r in rows if (r.get("rank_change") or 0) == 0]

    keyword_drops = Counter(r.get("keyword") or r.get("keyword_id") for r in declined)
    product_drops = Counter(r.get("product_id") for r in declined)

    return {
        "totalRecords": len(rows),
        "trackedProducts": len({r.get("product_id") for r in rows}),
        "trackedKeywords": len({r.get("keyword_id") for r in rows}),
        "improvedKeywords": len({r.get("keyword_id") for r in improved}),
        "declinedKeywords": len({r.get("keyword_id") for r in declined}),
        "stableSignals": len(stable),
        "criticalAlerts": sum(1 for a in alert_rows if a.get("severity") == "critical" and a.get("status") == "open"),
        "averageRankChange": round(mean(changes), 2) if changes else 0,
        "topDrops": sorted(declined, key=lambda r: r.get("rank_change") or 0, reverse=True)[:10],
        "topImprovements": sorted(improved, key=lambda r: r.get("rank_change") or 0)[:10],
        "productsWithMostDrops": product_drops.most_common(10),
        "repeatedDropKeywords": keyword_drops.most_common(10),
    }


def build_heatmap_matrix(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[str, list[int]] = defaultdict(list)
    drops: Counter[str] = Counter()
    for row in records:
        date = str(row.get("rank_date"))
        rank = row.get("organic_rank")
        if rank is not None:
            buckets[date].append(int(rank))
        if (row.get("rank_change") or 0) > 0:
            drops[date] += 1
    return [
        {
            "rank_date": d,
            "avg_rank": round(mean(vals), 2) if vals else None,
            "drops": drops[d],
            "intensity": min(1, (drops[d] / 6) + ((mean(vals) if vals else 40) / 160)),
        }
        for d, vals in sorted(buckets.items())
    ]

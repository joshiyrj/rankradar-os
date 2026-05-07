import unittest
from app.summaries import calculate_rank_summary, build_heatmap_matrix


class SummaryTests(unittest.TestCase):
    def test_summary_counts(self):
        rows = [
            {"product_id": "p1", "keyword_id": "k1", "rank_change": 5, "keyword": "alpha"},
            {"product_id": "p1", "keyword_id": "k2", "rank_change": -7, "keyword": "beta"},
            {"product_id": "p2", "keyword_id": "k3", "rank_change": 0, "keyword": "gamma"},
        ]
        alerts = [{"severity": "critical", "status": "open"}]
        result = calculate_rank_summary(rows, alerts)
        self.assertEqual(result["trackedProducts"], 2)
        self.assertEqual(result["trackedKeywords"], 3)
        self.assertEqual(result["criticalAlerts"], 1)
        self.assertEqual(result["declinedKeywords"], 1)

    def test_heatmap(self):
        rows = [
            {"rank_date": "2026-05-01", "organic_rank": 10, "rank_change": 2},
            {"rank_date": "2026-05-01", "organic_rank": 20, "rank_change": -1},
        ]
        matrix = build_heatmap_matrix(rows)
        self.assertEqual(matrix[0]["avg_rank"], 15)
        self.assertEqual(matrix[0]["drops"], 1)


if __name__ == "__main__":
    unittest.main()

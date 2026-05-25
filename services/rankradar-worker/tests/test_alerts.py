import unittest
from app.alerts import detect_alert, rank_health


class AlertTests(unittest.TestCase):
    def test_lost_page_1(self):
        # rank 8 → 25 — exits page 1
        decision = detect_alert(8, 25)
        self.assertEqual(decision.alert_type, "LOST_PAGE_1")
        self.assertEqual(decision.severity, "critical")

    def test_lost_top_50(self):
        # rank 48 → 55 — exits Top 50 (page-1 check: 48 > 16, so doesn't fire)
        decision = detect_alert(48, 55)
        self.assertEqual(decision.alert_type, "LOST_TOP_50")
        self.assertEqual(decision.severity, "critical")

    def test_lost_top_10(self):
        # rank 9 → 14 — exits Top 10, stays on page 1
        decision = detect_alert(9, 14)
        self.assertEqual(decision.alert_type, "LOST_TOP_10")
        self.assertEqual(decision.severity, "high")

    def test_critical_drop(self):
        # rank 55 → 70 — drops 15 positions, no exit event (was already outside Top 50)
        decision = detect_alert(55, 70)
        self.assertEqual(decision.alert_type, "CRITICAL_DROP")
        self.assertEqual(decision.severity, "critical")

    def test_major_drop(self):
        # rank 55 → 61 — drops 6 positions, no exit event
        decision = detect_alert(55, 61)
        self.assertEqual(decision.alert_type, "MAJOR_DROP")
        self.assertEqual(decision.severity, "high")

    def test_medium_drop(self):
        # rank 18 → 22 — near-Top-10 zone (11–20) to weak zone (21–50), drop of 4 positions
        # 18 > 16 so LOST_PAGE_1 does NOT fire; movement = 4 so CRITICAL/MAJOR DROP don't fire
        decision = detect_alert(18, 22)
        self.assertEqual(decision.alert_type, "MEDIUM_DROP")
        self.assertEqual(decision.severity, "medium")

    def test_large_improvement(self):
        # rank 30 → 20 — improves by 10 positions, no entry milestone (stays 21–50)
        decision = detect_alert(30, 20)
        self.assertEqual(decision.alert_type, "LARGE_IMPROVEMENT")
        self.assertEqual(decision.severity, "positive")

    def test_recovery(self):
        # rank 30 → 24 — improves by 6 positions, no milestone crossed
        decision = detect_alert(30, 24)
        self.assertEqual(decision.alert_type, "RECOVERY")
        self.assertEqual(decision.severity, "positive")

    def test_entered_top_10(self):
        # rank 14 → 8 — enters Top 10
        decision = detect_alert(14, 8)
        self.assertEqual(decision.alert_type, "ENTERED_TOP_10")
        self.assertEqual(decision.severity, "positive")

    def test_entered_top_50(self):
        # rank 60 → 45 — enters Top 50 (improvement is only 15 but entry milestone fires first)
        decision = detect_alert(60, 45)
        self.assertEqual(decision.alert_type, "ENTERED_TOP_50")
        self.assertEqual(decision.severity, "positive")

    def test_unranked(self):
        decision = detect_alert(14, None)
        self.assertEqual(decision.alert_type, "NEW_UNRANKED")

    def test_no_alert_for_small_drop_in_weak_zone(self):
        # rank 25 → 27 — minor drop within weak zone, no alert
        decision = detect_alert(25, 27)
        self.assertIsNone(decision)

    def test_health(self):
        self.assertEqual(rank_health(12, 28, "CRITICAL_DROP"), "critical")
        self.assertEqual(rank_health(12, 28, "LOST_TOP_50"), "critical")
        self.assertEqual(rank_health(-6, 9, None), "improving")
        self.assertEqual(rank_health(0, 5, None), "strong")
        self.assertEqual(rank_health(None, None, "LARGE_IMPROVEMENT"), "improving")
        self.assertEqual(rank_health(None, None, "ENTERED_TOP_50"), "improving")


if __name__ == "__main__":
    unittest.main()

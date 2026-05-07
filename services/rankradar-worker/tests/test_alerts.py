import unittest
from app.alerts import detect_alert, rank_health


class AlertTests(unittest.TestCase):
    def test_critical_drop(self):
        decision = detect_alert(8, 25)
        self.assertEqual(decision.alert_type, "LOST_PAGE_1")
        self.assertEqual(decision.severity, "critical")

    def test_major_drop(self):
        decision = detect_alert(40, 46)
        self.assertEqual(decision.alert_type, "MAJOR_DROP")
        self.assertEqual(decision.severity, "high")

    def test_recovery(self):
        decision = detect_alert(30, 20)
        self.assertEqual(decision.alert_type, "RECOVERY")
        self.assertEqual(decision.severity, "positive")

    def test_unranked(self):
        decision = detect_alert(14, None)
        self.assertEqual(decision.alert_type, "NEW_UNRANKED")

    def test_health(self):
        self.assertEqual(rank_health(12, 28, "CRITICAL_DROP"), "critical")
        self.assertEqual(rank_health(-6, 9, None), "improving")
        self.assertEqual(rank_health(0, 5, None), "strong")


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Any
from uuid import uuid4

from .alerts import detect_alert, rank_health
from .demo_data import BRANDS, MARKETPLACES, PRODUCTS, VARIATIONS, KEYWORDS, generate_rank_records
from .settings import Settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  datadive_brand_id TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS marketplaces (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amazon_domain TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  datadive_product_id TEXT UNIQUE,
  brand_id TEXT NOT NULL,
  marketplace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  asin TEXT NOT NULL,
  parent_asin TEXT,
  sku TEXT,
  image_url TEXT,
  datadive_status TEXT,
  keyword_count INTEGER DEFAULT 0,
  top10_kw INTEGER DEFAULT 0,
  top10_sv INTEGER DEFAULT 0,
  top50_kw INTEGER DEFAULT 0,
  top50_sv INTEGER DEFAULT 0,
  raw_payload TEXT,
  last_synced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS product_variations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  child_asin TEXT NOT NULL,
  sku TEXT,
  title TEXT,
  variation_label TEXT,
  image_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, child_asin)
);
CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY,
  datadive_keyword_id TEXT UNIQUE,
  keyword TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  search_volume INTEGER,
  priority TEXT DEFAULT 'standard',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rank_records (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variation_id TEXT,
  keyword_id TEXT NOT NULL,
  marketplace_id TEXT NOT NULL,
  rank_date TEXT NOT NULL,
  day_name TEXT NOT NULL,
  organic_rank INTEGER,
  previous_organic_rank INTEGER,
  rank_change INTEGER,
  sponsored_rank INTEGER,
  ppc_spend REAL,
  ppc_sales REAL,
  ppc_units INTEGER,
  impressions INTEGER,
  clicks INTEGER,
  ctr REAL,
  conversion_rate REAL,
  raw_payload TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variation_id, keyword_id, marketplace_id, rank_date)
);
CREATE TABLE IF NOT EXISTS rank_alerts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  variation_id TEXT,
  keyword_id TEXT NOT NULL,
  marketplace_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  previous_rank INTEGER,
  current_rank INTEGER,
  rank_change INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TEXT NOT NULL,
  acknowledged_at TEXT,
  resolved_at TEXT,
  raw_context TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  rule_type TEXT NOT NULL,
  threshold_value INTEGER NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  raw_context TEXT
);
"""


class RankRadarStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        Path(settings.db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.settings.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init_db(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            existing = {row["name"] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
            additions = {
                "datadive_status": "TEXT",
                "keyword_count": "INTEGER DEFAULT 0",
                "top10_kw": "INTEGER DEFAULT 0",
                "top10_sv": "INTEGER DEFAULT 0",
                "top50_kw": "INTEGER DEFAULT 0",
                "top50_sv": "INTEGER DEFAULT 0",
                "raw_payload": "TEXT",
            }
            for name, definition in additions.items():
                if name not in existing:
                    conn.execute(f"ALTER TABLE products ADD COLUMN {name} {definition}")

    def seed_if_empty(self) -> None:
        with self.connect() as conn:
            count = conn.execute("SELECT COUNT(*) AS c FROM brands").fetchone()["c"]
            if count:
                return
        self.upsert_seed_data()

    def upsert_seed_data(self) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as conn:
            for row in BRANDS:
                conn.execute("INSERT OR REPLACE INTO brands(id, datadive_brand_id, name) VALUES(?,?,?)", (row["id"], row["datadive_brand_id"], row["name"]))
            for row in MARKETPLACES:
                conn.execute("INSERT OR REPLACE INTO marketplaces(id, code, name, amazon_domain) VALUES(?,?,?,?)", (row["id"], row["code"], row["name"], row["amazon_domain"]))
            for row in PRODUCTS:
                conn.execute("""INSERT OR REPLACE INTO products(id, datadive_product_id, brand_id, marketplace_id, title, asin, parent_asin, sku, image_url, last_synced_at)
                              VALUES(?,?,?,?,?,?,?,?,?,?)""", (row["id"], row["datadive_product_id"], row["brand_id"], row["marketplace_id"], row["title"], row["asin"], row["parent_asin"], row["sku"], row["image_url"], now))
            for row in VARIATIONS:
                conn.execute("""INSERT OR REPLACE INTO product_variations(id, product_id, child_asin, sku, title, variation_label, image_url)
                              VALUES(?,?,?,?,?,?,?)""", (row["id"], row["product_id"], row["child_asin"], row["sku"], row["title"], row["variation_label"], row.get("image_url")))
            for row in KEYWORDS:
                conn.execute("""INSERT OR REPLACE INTO keywords(id, datadive_keyword_id, keyword, normalized_keyword, search_volume, priority)
                              VALUES(?,?,?,?,?,?)""", (row["id"], row["datadive_keyword_id"], row["keyword"], row["normalized_keyword"], row["search_volume"], row["priority"]))
            for row in generate_rank_records():
                conn.execute("""INSERT OR REPLACE INTO rank_records(id, product_id, variation_id, keyword_id, marketplace_id, rank_date, day_name, organic_rank,
                              previous_organic_rank, rank_change, sponsored_rank, ppc_spend, ppc_sales, ppc_units, impressions, clicks, ctr, conversion_rate, raw_payload)
                              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                             (row["id"], row["product_id"], row["variation_id"], row["keyword_id"], row["marketplace_id"], row["rank_date"], row["day_name"], row["organic_rank"], row["previous_organic_rank"], row["rank_change"], row["sponsored_rank"], row["ppc_spend"], row["ppc_sales"], row["ppc_units"], row["impressions"], row["clicks"], row["ctr"], row["conversion_rate"], json.dumps(row["raw_payload"])))
        self.rebuild_alerts()

    def replace_live_rank_radars(self, products: list[dict[str, Any]]) -> None:
        """Normalize DataDive Rank Radar list rows into the dashboard schema.

        DataDive's list endpoint contains product, marketplace, keyword count, and top-10/top-50
        summary metrics. This method stores only fields returned by DataDive and never invents ranks.
        """
        now = datetime.now(timezone.utc).isoformat()
        marketplaces = sorted({str(row.get("marketplace") or "com") for row in products})
        with self.connect() as conn:
            conn.execute("DELETE FROM rank_alerts")
            conn.execute("DELETE FROM rank_records")
            conn.execute("DELETE FROM keywords WHERE datadive_keyword_id LIKE 'datadive-summary-%'")
            conn.execute("DELETE FROM product_variations WHERE product_id LIKE 'rr-%'")
            conn.execute("DELETE FROM products WHERE datadive_product_id IS NOT NULL")
            conn.execute("DELETE FROM brands WHERE datadive_brand_id LIKE 'datadive-%'")
            conn.execute("DELETE FROM marketplaces WHERE id LIKE 'market-%'")

            for code in marketplaces or ["com"]:
                conn.execute(
                    "INSERT OR REPLACE INTO brands(id, datadive_brand_id, name) VALUES(?,?,?)",
                    (f"brand-datadive-{code}", f"datadive-{code}", f"DataDive {code.upper()} Rank Radars"),
                )
                conn.execute(
                    "INSERT OR REPLACE INTO marketplaces(id, code, name, amazon_domain) VALUES(?,?,?,?)",
                    (f"market-{code}", code, f"Amazon {code}", f"amazon.{code}"),
                )

            for index, item in enumerate(products):
                rank_radar_id = str(item.get("id") or item.get("rankRadarId") or f"rank-radar-{index}")
                asin_obj = item.get("asin") if isinstance(item.get("asin"), dict) else {}
                marketplace = str(item.get("marketplace") or "com")
                product_id = f"rr-{rank_radar_id}"
                asin = str(asin_obj.get("asin") or item.get("asin") or rank_radar_id[:10]).upper()
                parent_asin = asin_obj.get("parent_asin") or item.get("parentAsin") or asin
                title = item.get("title") or asin_obj.get("title") or f"DataDive Rank Radar {asin}"
                image_url = item.get("imageUrl") or asin_obj.get("image_url") or ""
                keyword_count = int(item.get("keywordCount") or 0)
                top10 = int(item.get("top10KW") or 0)
                top50 = int(item.get("top50KW") or 0)
                top10_sv = int(item.get("top10SV") or 0)
                top50_sv = int(item.get("top50SV") or 0)

                conn.execute(
                    """INSERT OR REPLACE INTO products(id, datadive_product_id, brand_id, marketplace_id, title, asin, parent_asin, sku, image_url,
                       datadive_status, keyword_count, top10_kw, top10_sv, top50_kw, top50_sv, raw_payload, last_synced_at)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        product_id,
                        rank_radar_id,
                        f"brand-datadive-{marketplace}",
                        f"market-{marketplace}",
                        title,
                        asin,
                        parent_asin,
                        asin,
                        image_url,
                        str(item.get("status") or ""),
                        keyword_count,
                        top10,
                        top10_sv,
                        top50,
                        top50_sv,
                        json.dumps(item),
                        now,
                    ),
                )

                variation_id = f"var-{rank_radar_id}"
                conn.execute(
                    """INSERT OR REPLACE INTO product_variations(id, product_id, child_asin, sku, title, variation_label, image_url)
                       VALUES(?,?,?,?,?,?,?)""",
                    (variation_id, product_id, asin, asin, title, "Tracked ASIN", image_url),
                )

    def rebuild_alerts(self) -> int:
        inserted = 0
        with self.connect() as conn:
            records = conn.execute("SELECT * FROM rank_records WHERE previous_organic_rank IS NOT NULL ORDER BY rank_date").fetchall()
            for row in records:
                decision = detect_alert(row["previous_organic_rank"], row["organic_rank"])
                if not decision:
                    continue
                exists = conn.execute("""SELECT id FROM rank_alerts WHERE product_id=? AND COALESCE(variation_id,'')=COALESCE(?, '') AND keyword_id=? AND marketplace_id=? AND alert_type=? AND detected_at=?""",
                                      (row["product_id"], row["variation_id"], row["keyword_id"], row["marketplace_id"], decision.alert_type, row["rank_date"])).fetchone()
                if exists:
                    continue
                conn.execute("""INSERT INTO rank_alerts(id, product_id, variation_id, keyword_id, marketplace_id, alert_type, severity, previous_rank,
                              current_rank, rank_change, status, detected_at, raw_context)
                              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                             (f"alert-{uuid4().hex[:12]}", row["product_id"], row["variation_id"], row["keyword_id"], row["marketplace_id"], decision.alert_type,
                              decision.severity, row["previous_organic_rank"], row["organic_rank"], decision.rank_change, "open", row["rank_date"], json.dumps({"message": decision.message})))
                inserted += 1
        return inserted

    def list_brands(self) -> list[dict]:
        with self.connect() as conn:
            return [dict(r) for r in conn.execute("SELECT * FROM brands ORDER BY name")]

    def list_marketplaces(self, brand_id: str | None = None) -> list[dict]:
        with self.connect() as conn:
            if brand_id:
                rows = conn.execute("""SELECT DISTINCT m.* FROM marketplaces m JOIN products p ON p.marketplace_id=m.id WHERE p.brand_id=? ORDER BY m.name""", (brand_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM marketplaces ORDER BY name").fetchall()
            return [dict(r) for r in rows]

    def get_products(self, brand_id: str | None, marketplace: str | None, status: str | None = None) -> list[dict]:
        params: list[Any] = []
        clauses = []
        if brand_id:
            clauses.append("p.brand_id=?")
            params.append(brand_id)
        if marketplace:
            clauses.append("m.code=?")
            params.append(marketplace)
        where = "WHERE " + " AND ".join(clauses) if clauses else ""
        sql = f"""
        SELECT p.*, b.name AS brand_name, m.code AS marketplace_code, m.name AS marketplace_name,
          COALESCE(p.keyword_count, COUNT(DISTINCT rr.keyword_id)) AS tracked_keywords,
          COUNT(DISTINCT pv.id) AS variation_count,
          SUM(CASE WHEN rr.rank_change > 0 THEN 1 ELSE 0 END) AS declining_points,
          SUM(CASE WHEN rr.rank_change < 0 THEN 1 ELSE 0 END) AS improving_points,
          COALESCE(MAX(CASE WHEN ra.status='open' AND ra.severity='critical' THEN 1 ELSE 0 END), 0) AS has_critical,
          COUNT(DISTINCT CASE WHEN ra.status='open' THEN ra.id END) AS open_alerts,
          COUNT(DISTINCT CASE WHEN ra.status='open' AND ra.severity='critical' THEN ra.id END) AS critical_alerts
        FROM products p
        JOIN brands b ON b.id=p.brand_id
        JOIN marketplaces m ON m.id=p.marketplace_id
        LEFT JOIN product_variations pv ON pv.product_id=p.id
        LEFT JOIN rank_records rr ON rr.product_id=p.id
        LEFT JOIN rank_alerts ra ON ra.product_id=p.id
        {where}
        GROUP BY p.id
        ORDER BY p.keyword_count DESC, p.top50_sv DESC, p.title ASC
        """
        with self.connect() as conn:
            rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
        for row in rows:
            row["health_status"] = "critical" if row["critical_alerts"] else ("watch" if row["open_alerts"] else "stable")
        if status:
            rows = [r for r in rows if r["health_status"] == status]
        return rows

    def product_header(self, product_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("""SELECT p.*, b.name brand_name, m.code marketplace_code, m.name marketplace_name FROM products p
                                  JOIN brands b ON b.id=p.brand_id JOIN marketplaces m ON m.id=p.marketplace_id WHERE p.id=?""", (product_id,)).fetchone()
            return dict(row) if row else None

    def product_summary(self, product_id: str) -> dict:
        with self.connect() as conn:
            product = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
            latest = conn.execute("""
                SELECT rr.* FROM rank_records rr
                JOIN (SELECT variation_id, keyword_id, MAX(rank_date) max_date FROM rank_records WHERE product_id=? GROUP BY variation_id, keyword_id) x
                ON x.variation_id=rr.variation_id AND x.keyword_id=rr.keyword_id AND x.max_date=rr.rank_date
                WHERE rr.product_id=?
            """, (product_id, product_id)).fetchall()
            alerts = conn.execute("SELECT severity, status, COUNT(*) c FROM rank_alerts WHERE product_id=? GROUP BY severity, status", (product_id,)).fetchall()
            heatmap = conn.execute("""SELECT rank_date, AVG(organic_rank) avg_rank, SUM(CASE WHEN rank_change > 0 THEN 1 ELSE 0 END) drops FROM rank_records WHERE product_id=? GROUP BY rank_date ORDER BY rank_date""", (product_id,)).fetchall()
        changes = [r["rank_change"] for r in latest if r["rank_change"] is not None]
        improved = sum(1 for c in changes if c < 0)
        declined = sum(1 for c in changes if c > 0)
        stable = sum(1 for c in changes if c == 0)
        critical = sum(a["c"] for a in alerts if a["severity"] == "critical" and a["status"] == "open")
        if product and product["raw_payload"]:
            return {
                "trackedKeywords": int(product["keyword_count"] or 0),
                "variationSignals": 1,
                "improved": 0,
                "declined": 0,
                "stable": 0,
                "criticalAlerts": 0,
                "avgRankChange": 0,
                "top10KW": int(product["top10_kw"] or 0),
                "top10SV": int(product["top10_sv"] or 0),
                "top50KW": int(product["top50_kw"] or 0),
                "top50SV": int(product["top50_sv"] or 0),
                "status": product["datadive_status"] or "",
                "source": "datadive",
                "heatmap": [],
            }
        return {
            "trackedKeywords": len({r["keyword_id"] for r in latest}),
            "variationSignals": len(latest),
            "improved": improved,
            "declined": declined,
            "stable": stable,
            "criticalAlerts": critical,
            "avgRankChange": round(sum(changes) / len(changes), 2) if changes else 0,
            "heatmap": [dict(r) for r in heatmap],
        }

    def keyword_rows(self, product_id: str, q: str | None = None, status: str | None = None, movement: str | None = None) -> list[dict]:
        params: list[Any] = [product_id]
        sql = """
        SELECT rr.*, k.keyword, k.search_volume, k.priority, pv.child_asin, pv.sku variation_sku, pv.variation_label, m.code marketplace_code,
               COALESCE(ra.alert_type, '') alert_type, COALESCE(ra.severity, '') severity, COALESCE(ra.status, '') alert_status
        FROM rank_records rr
        JOIN keywords k ON k.id=rr.keyword_id
        LEFT JOIN product_variations pv ON pv.id=rr.variation_id
        JOIN marketplaces m ON m.id=rr.marketplace_id
        LEFT JOIN rank_alerts ra ON ra.product_id=rr.product_id AND COALESCE(ra.variation_id,'')=COALESCE(rr.variation_id,'') AND ra.keyword_id=rr.keyword_id AND ra.detected_at=rr.rank_date
        WHERE rr.product_id=? AND rr.rank_date=(SELECT MAX(rank_date) FROM rank_records WHERE product_id=rr.product_id)
        """
        if q:
            sql += " AND LOWER(k.keyword) LIKE ?"
            params.append(f"%{q.lower()}%")
        sql += " ORDER BY CASE WHEN ra.severity='critical' THEN 0 WHEN ra.severity='high' THEN 1 ELSE 2 END, rr.rank_change DESC, k.keyword"
        with self.connect() as conn:
            rows = [dict(r) for r in conn.execute(sql, params).fetchall()]
        for row in rows:
            row["health"] = rank_health(row.get("rank_change"), row.get("organic_rank"), row.get("alert_type") or None)
        if status:
            rows = [r for r in rows if r["health"] == status or r.get("alert_status") == status]
        if movement == "improved":
            rows = [r for r in rows if (r.get("rank_change") or 0) < 0]
        if movement == "declined":
            rows = [r for r in rows if (r.get("rank_change") or 0) > 0]
        return rows

    def trend(self, product_id: str, keyword_id: str) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("""SELECT rank_date, AVG(organic_rank) organic_rank, AVG(sponsored_rank) sponsored_rank, AVG(ppc_spend) ppc_spend, AVG(ppc_sales) ppc_sales
                                   FROM rank_records WHERE product_id=? AND keyword_id=? GROUP BY rank_date ORDER BY rank_date""", (product_id, keyword_id)).fetchall()
            return [dict(r) for r in rows]

    def variations(self, product_id: str, keyword_id: str) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("""SELECT rr.*, pv.child_asin, pv.sku, pv.variation_label, pv.title FROM rank_records rr
                                   LEFT JOIN product_variations pv ON pv.id=rr.variation_id
                                   WHERE rr.product_id=? AND rr.keyword_id=? AND rr.rank_date=(SELECT MAX(rank_date) FROM rank_records WHERE product_id=? AND keyword_id=?)
                                   ORDER BY rr.organic_rank ASC""", (product_id, keyword_id, product_id, keyword_id)).fetchall()
            return [dict(r) for r in rows]

    def alerts(self, filters: dict[str, Any]) -> list[dict]:
        params: list[Any] = []
        clauses = []
        if filters.get("brandId"):
            clauses.append("p.brand_id=?")
            params.append(filters["brandId"])
        if filters.get("marketplace"):
            clauses.append("m.code=?")
            params.append(filters["marketplace"])
        if filters.get("productId"):
            clauses.append("ra.product_id=?")
            params.append(filters["productId"])
        if filters.get("severity"):
            clauses.append("ra.severity=?")
            params.append(filters["severity"])
        if filters.get("status"):
            clauses.append("ra.status=?")
            params.append(filters["status"])
        where = "WHERE " + " AND ".join(clauses) if clauses else ""
        with self.connect() as conn:
            rows = conn.execute(f"""SELECT ra.*, p.title product_title, p.asin, p.sku product_sku, b.name brand_name, m.code marketplace_code, k.keyword, pv.child_asin, pv.variation_label
                                    FROM rank_alerts ra JOIN products p ON p.id=ra.product_id JOIN brands b ON b.id=p.brand_id
                                    JOIN marketplaces m ON m.id=ra.marketplace_id JOIN keywords k ON k.id=ra.keyword_id
                                    LEFT JOIN product_variations pv ON pv.id=ra.variation_id
                                    {where} ORDER BY CASE ra.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, ra.detected_at DESC""", params).fetchall()
            return [dict(r) for r in rows]

    def update_alert_status(self, alert_id: str, status: str) -> dict | None:
        now = datetime.now(timezone.utc).isoformat()
        field = "acknowledged_at" if status == "acknowledged" else "resolved_at"
        with self.connect() as conn:
            conn.execute(f"UPDATE rank_alerts SET status=?, {field}=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (status, now, alert_id))
            row = conn.execute("SELECT * FROM rank_alerts WHERE id=?", (alert_id,)).fetchone()
            return dict(row) if row else None

    def alert_rules(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM alert_rules ORDER BY scope_type, rule_type").fetchall()
            return [dict(r) for r in rows]

    def add_alert_rule(self, payload: dict[str, Any]) -> dict:
        row = {
            "id": payload.get("id") or f"rule-{uuid4().hex[:10]}",
            "scope_type": payload.get("scope_type", "global"),
            "scope_id": payload.get("scope_id"),
            "rule_type": payload.get("rule_type", "CRITICAL_DROP"),
            "threshold_value": int(payload.get("threshold_value", 10)),
            "enabled": 1 if payload.get("enabled", True) else 0,
        }
        with self.connect() as conn:
            conn.execute("INSERT INTO alert_rules(id, scope_type, scope_id, rule_type, threshold_value, enabled) VALUES(?,?,?,?,?,?)", tuple(row.values()))
        return row

    def sync_runs(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 25").fetchall()
            return [dict(r) for r in rows]

    def record_sync_run(self, status: str, records_processed: int = 0, error_message: str | None = None, raw_context: dict | None = None) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        row = {"id": f"sync-{uuid4().hex[:12]}", "source": "datadive", "status": status, "started_at": now, "completed_at": now, "records_processed": records_processed, "error_message": error_message, "raw_context": json.dumps(raw_context or {})}
        with self.connect() as conn:
            conn.execute("INSERT INTO sync_runs(id, source, status, started_at, completed_at, records_processed, error_message, raw_context) VALUES(?,?,?,?,?,?,?,?)", tuple(row.values()))
        return row

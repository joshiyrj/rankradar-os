from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pymongo import ASCENDING, MongoClient, UpdateOne

from .settings import Settings


class MongoRankRadarStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)
        self.client.admin.command("ping")
        self.db = self.client[settings.mongodb_db]
        self._ensure_indexes()

    def _ensure_indexes(self) -> None:
        self.db.brands.create_index([("id", ASCENDING)], unique=True)
        self.db.marketplaces.create_index([("id", ASCENDING)], unique=True)
        self.db.products.create_index([("id", ASCENDING)], unique=True)
        self.db.products.create_index([("datadive_product_id", ASCENDING)], unique=True)
        self.db.sync_runs.create_index([("started_at", ASCENDING)])

    def seed_if_empty(self) -> None:
        return None

    def _clean(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if not row:
            return None
        row = dict(row)
        row.pop("_id", None)
        return row

    def replace_live_rank_radars(self, products: list[dict[str, Any]]) -> None:
        now = datetime.now(timezone.utc).isoformat()
        marketplace_codes = sorted({str(row.get("marketplace") or "com") for row in products})

        brand_ops = []
        marketplace_ops = []
        for code in marketplace_codes or ["com"]:
            brand = {"id": f"brand-datadive-{code}", "datadive_brand_id": f"datadive-{code}", "name": f"DataDive {code.upper()} Rank Radars", "updated_at": now}
            marketplace = {"id": f"market-{code}", "code": code, "name": f"Amazon {code}", "amazon_domain": f"amazon.{code}", "updated_at": now}
            brand_ops.append(UpdateOne({"id": brand["id"]}, {"$set": brand, "$setOnInsert": {"created_at": now}}, upsert=True))
            marketplace_ops.append(UpdateOne({"id": marketplace["id"]}, {"$set": marketplace, "$setOnInsert": {"created_at": now}}, upsert=True))
        if brand_ops:
            self.db.brands.bulk_write(brand_ops, ordered=False)
        if marketplace_ops:
            self.db.marketplaces.bulk_write(marketplace_ops, ordered=False)

        product_ops = []
        variation_ops = []
        for index, item in enumerate(products):
            rank_radar_id = str(item.get("id") or item.get("rankRadarId") or f"rank-radar-{index}")
            asin_obj = item.get("asin") if isinstance(item.get("asin"), dict) else {}
            marketplace = str(item.get("marketplace") or "com")
            asin = str(asin_obj.get("asin") or item.get("asin") or rank_radar_id[:10]).upper()
            product = {
                "id": f"rr-{rank_radar_id}",
                "datadive_product_id": rank_radar_id,
                "brand_id": f"brand-datadive-{marketplace}",
                "marketplace_id": f"market-{marketplace}",
                "brand_name": f"DataDive {marketplace.upper()} Rank Radars",
                "marketplace_code": marketplace,
                "marketplace_name": f"Amazon {marketplace}",
                "title": item.get("title") or asin_obj.get("title") or f"DataDive Rank Radar {asin}",
                "asin": asin,
                "parent_asin": asin_obj.get("parent_asin") or item.get("parentAsin") or asin,
                "sku": asin,
                "image_url": item.get("imageUrl") or asin_obj.get("image_url") or "",
                "datadive_status": str(item.get("status") or ""),
                "keyword_count": int(item.get("keywordCount") or 0),
                "tracked_keywords": int(item.get("keywordCount") or 0),
                "top10_kw": int(item.get("top10KW") or 0),
                "top10_sv": int(item.get("top10SV") or 0),
                "top50_kw": int(item.get("top50KW") or 0),
                "top50_sv": int(item.get("top50SV") or 0),
                "variation_count": 1,
                "open_alerts": 0,
                "critical_alerts": 0,
                "health_status": "stable",
                "raw_payload": item,
                "last_synced_at": now,
                "updated_at": now,
            }
            product_ops.append(UpdateOne({"id": product["id"]}, {"$set": product, "$setOnInsert": {"created_at": now}}, upsert=True))
            variation = {
                "id": f"var-{rank_radar_id}",
                "product_id": product["id"],
                "child_asin": asin,
                "sku": asin,
                "title": product["title"],
                "variation_label": "Tracked ASIN",
                "image_url": product["image_url"],
                "updated_at": now,
            }
            variation_ops.append(UpdateOne({"id": variation["id"]}, {"$set": variation, "$setOnInsert": {"created_at": now}}, upsert=True))
        if product_ops:
            self.db.products.bulk_write(product_ops, ordered=False)
        if variation_ops:
            self.db.product_variations.bulk_write(variation_ops, ordered=False)

    def list_brands(self) -> list[dict[str, Any]]:
        return [self._clean(row) for row in self.db.brands.find({}, {"_id": 0}).sort("name", ASCENDING)]

    def list_marketplaces(self, brand_id: str | None = None) -> list[dict[str, Any]]:
        if brand_id:
            product_marketplaces = self.db.products.distinct("marketplace_id", {"brand_id": brand_id})
            query = {"id": {"$in": product_marketplaces}}
        else:
            query = {}
        return [self._clean(row) for row in self.db.marketplaces.find(query, {"_id": 0}).sort("name", ASCENDING)]

    def get_products(self, brand_id: str | None, marketplace: str | None, status: str | None = None) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if brand_id:
            query["brand_id"] = brand_id
        if marketplace:
            query["marketplace_code"] = marketplace
        if status:
            query["health_status"] = status
        return [self._clean(row) for row in self.db.products.find(query, {"_id": 0}).sort([("keyword_count", -1), ("top50_sv", -1), ("title", 1)])]

    def product_header(self, product_id: str) -> dict[str, Any] | None:
        return self._clean(self.db.products.find_one({"id": product_id}, {"_id": 0}))

    def product_summary(self, product_id: str) -> dict[str, Any]:
        product = self.product_header(product_id) or {}
        return {
            "trackedKeywords": int(product.get("keyword_count") or 0),
            "variationSignals": 1 if product else 0,
            "improved": 0,
            "declined": 0,
            "stable": 0,
            "criticalAlerts": 0,
            "avgRankChange": 0,
            "top10KW": int(product.get("top10_kw") or 0),
            "top10SV": int(product.get("top10_sv") or 0),
            "top50KW": int(product.get("top50_kw") or 0),
            "top50SV": int(product.get("top50_sv") or 0),
            "status": product.get("datadive_status") or "",
            "source": "datadive",
            "heatmap": [],
        }

    def keyword_rows(self, product_id: str, q: str | None = None, status: str | None = None, movement: str | None = None) -> list[dict[str, Any]]:
        return []

    def trend(self, product_id: str, keyword_id: str) -> list[dict[str, Any]]:
        return []

    def variations(self, product_id: str, keyword_id: str) -> list[dict[str, Any]]:
        return []

    def alerts(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        return []

    def update_alert_status(self, alert_id: str, status: str) -> dict[str, Any] | None:
        return None

    def alert_rules(self) -> list[dict[str, Any]]:
        return []

    def add_alert_rule(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"id": payload.get("id") or f"rule-{uuid4().hex[:10]}", **payload}

    def sync_runs(self) -> list[dict[str, Any]]:
        return [self._clean(row) for row in self.db.sync_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(25)]

    def record_sync_run(self, status: str, records_processed: int = 0, error_message: str | None = None, raw_context: dict | None = None) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": f"sync-{uuid4().hex[:12]}",
            "source": "datadive",
            "status": status,
            "started_at": now,
            "completed_at": now,
            "records_processed": records_processed,
            "error_message": error_message,
            "raw_context": raw_context or {},
        }
        self.db.sync_runs.update_one({"id": row["id"]}, {"$set": row}, upsert=True)
        return row

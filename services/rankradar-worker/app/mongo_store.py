from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pymongo import ASCENDING, DESCENDING, MongoClient, UpdateOne

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

    def replace_live_rank_radars(self, products: list[dict[str, Any]], brands: list[dict[str, Any]] | None = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        marketplace_codes = sorted({str(row.get("marketplace") or "com") for row in products})

        # Build niche_id → brand doc lookup for product linking
        niche_to_brand: dict[str, dict] = {}
        if brands:
            for b in brands:
                nid = str(b.get("datadive_brand_id") or "")
                if nid:
                    niche_to_brand[nid] = b

        from .datadive_client import _marketplace_name

        brand_ops = []
        marketplace_ops = []

        if brands:
            for b in brands:
                brand_doc = {"id": b["id"], "datadive_brand_id": b.get("datadive_brand_id", ""), "name": b.get("name", b["id"]), "updated_at": now}
                brand_ops.append(UpdateOne({"id": b["id"]}, {"$set": brand_doc, "$setOnInsert": {"created_at": now}}, upsert=True))
        else:
            for code in marketplace_codes or ["com"]:
                brand_doc = {"id": f"brand-datadive-{code}", "datadive_brand_id": f"datadive-{code}", "name": f"DataDive {code.upper()} Rank Radars", "updated_at": now}
                brand_ops.append(UpdateOne({"id": brand_doc["id"]}, {"$set": brand_doc, "$setOnInsert": {"created_at": now}}, upsert=True))

        for code in marketplace_codes or ["com"]:
            mp = {"id": f"market-{code}", "code": code, "name": _marketplace_name(code), "amazon_domain": f"amazon.{code}", "updated_at": now}
            marketplace_ops.append(UpdateOne({"id": mp["id"]}, {"$set": mp, "$setOnInsert": {"created_at": now}}, upsert=True))

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

            # Resolve brand: try nicheId → real brand, fall back to marketplace code
            niche = item.get("niche") or {}
            if isinstance(niche, str):
                niche = {}
            niche_id = str(
                item.get("nicheId") or item.get("niche_id") or item.get("brandId")
                or niche.get("id") or niche.get("nicheId") or ""
            )
            brand_doc = niche_to_brand.get(niche_id)
            brand_id = brand_doc["id"] if brand_doc else f"brand-datadive-{marketplace}"
            brand_name = brand_doc["name"] if brand_doc else f"DataDive {marketplace.upper()} Rank Radars"

            product = {
                "id": f"rr-{rank_radar_id}",
                "datadive_product_id": rank_radar_id,
                "brand_id": brand_id,
                "marketplace_id": f"market-{marketplace}",
                "brand_name": brand_name,
                "marketplace_code": marketplace,
                "marketplace_name": _marketplace_name(marketplace),
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

    def keyword_heatmap(self, product_id: str, start: str | None = None, end: str | None = None) -> list[dict[str, Any]]:
        return []

    def trend(self, product_id: str, keyword_id: str) -> list[dict[str, Any]]:
        return []

    def variations(self, product_id: str, keyword_id: str) -> list[dict[str, Any]]:
        return []

    def alerts(self, filters: dict[str, Any]) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if filters.get("productId"):
            query["product_id"] = filters["productId"]
        if filters.get("severity"):
            query["severity"] = filters["severity"]
        if filters.get("status"):
            query["status"] = filters["status"]
        rows = list(self.db.rank_alerts.find(query, {"_id": 0}).sort([
            ("severity_order", ASCENDING),
            ("detected_at", DESCENDING),
        ]).limit(200))
        return [self._clean(r) for r in rows]

    def update_alert_status(self, alert_id: str, status: str) -> dict[str, Any] | None:
        now = datetime.now(timezone.utc).isoformat()
        timestamp_field = {
            "acknowledged": "acknowledged_at",
            "reviewed": "acknowledged_at",
            "ignored": "acknowledged_at",
            "resolved": "resolved_at",
        }.get(status, "acknowledged_at")
        self.db.rank_alerts.update_one(
            {"id": alert_id},
            {"$set": {"status": status, timestamp_field: now, "updated_at": now}},
        )
        row = self.db.rank_alerts.find_one({"id": alert_id}, {"_id": 0})
        return self._clean(row)

    def upsert_keyword_benchmarking_snapshot(
        self,
        product_id: str,
        keyword_id: str,
        marketplace_id: str,
        snapshot_date: str,
        our_asin_share: float | None = None,
        our_ctr: float | None = None,
        our_cvr: float | None = None,
        datadive_source: str | None = None,
        raw_payload: dict | None = None,
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "product_id": product_id,
            "keyword_id": keyword_id,
            "marketplace_id": marketplace_id,
            "snapshot_date": snapshot_date,
            "our_asin_share": our_asin_share,
            "our_ctr": our_ctr,
            "our_cvr": our_cvr,
            "datadive_source": datadive_source,
            "raw_payload": raw_payload,
            "updated_at": now,
        }
        self.db.keyword_benchmarking_snapshots.update_one(
            {"product_id": product_id, "keyword_id": keyword_id, "marketplace_id": marketplace_id, "snapshot_date": snapshot_date},
            {"$set": doc, "$setOnInsert": {"id": f"kbs-{uuid4().hex[:12]}", "created_at": now}},
            upsert=True,
        )

    def insert_raw_api_response(
        self,
        endpoint: str,
        request_params: dict | None,
        response_body: Any,
        status_code: int,
        sync_run_id: str | None = None,
        provider: str = "datadive",
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.db.raw_api_responses.insert_one({
            "id": f"raw-{uuid4().hex[:12]}",
            "provider": provider,
            "endpoint": endpoint,
            "request_params": request_params,
            "response_body": response_body,
            "status_code": status_code,
            "sync_run_id": sync_run_id,
            "created_at": now,
        })

    def alert_rules(self) -> list[dict[str, Any]]:
        return []

    def add_alert_rule(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"id": payload.get("id") or f"rule-{uuid4().hex[:10]}", **payload}

    def sync_runs(self) -> list[dict[str, Any]]:
        return [self._clean(row) for row in self.db.sync_runs.find({}, {"_id": 0}).sort("started_at", -1).limit(25)]

    def record_sync_run(self, status: str, sync_run_id: str | None = None, records_processed: int = 0, error_message: str | None = None, raw_context: dict | None = None) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": sync_run_id or f"sync-{uuid4().hex[:12]}",
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

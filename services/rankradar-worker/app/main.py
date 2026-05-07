from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .datadive_client import make_client
from .mongo_store import MongoRankRadarStore
from .settings import get_settings
from .store import RankRadarStore
from .sync import run_sync

settings = get_settings()
store = MongoRankRadarStore(settings) if settings.datadive_provider.lower() in {"live", "http", "datadive"} else RankRadarStore(settings)
if settings.datadive_provider.lower() not in {"live", "http", "datadive"}:
    store.seed_if_empty()
client = make_client(settings)

app = FastAPI(title="RankRadar OS Data Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_sync() -> None:
    if settings.datadive_provider.lower() in {"live", "http", "datadive"} and not store.get_products(None, None):
        await run_sync(store, client)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "rankradar-worker", "provider": settings.datadive_provider}


@app.get("/datadive/status")
def datadive_status() -> dict[str, Any]:
    return {
        "provider": settings.datadive_provider,
        "baseUrlConfigured": bool(settings.datadive_api_base_url),
        "apiKeyConfigured": bool(settings.datadive_api_key),
        "orgConfigured": bool(settings.datadive_org_id),
        "schedulerEnabled": settings.enable_scheduler,
    }


@app.post("/datadive/test-connection")
async def test_connection() -> dict[str, Any]:
    try:
        return await client.test_connection()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/rank-radar/brands")
def brands() -> list[dict[str, Any]]:
    return store.list_brands()


@app.get("/rank-radar/marketplaces")
def marketplaces(brandId: str | None = None) -> list[dict[str, Any]]:
    return store.list_marketplaces(brandId)


@app.get("/rank-radar/products")
def products(brandId: str | None = None, marketplace: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
    return store.get_products(brandId, marketplace, status)


@app.get("/rank-radar/products/{product_id}")
def product(product_id: str) -> dict[str, Any]:
    header = store.product_header(product_id)
    if not header:
        raise HTTPException(status_code=404, detail="Product not found")
    return header


@app.get("/rank-radar/products/{product_id}/summary")
def product_summary(product_id: str) -> dict[str, Any]:
    return store.product_summary(product_id)


@app.get("/rank-radar/products/{product_id}/keywords")
def product_keywords(product_id: str, q: str | None = None, status: str | None = None, movement: str | None = None) -> list[dict[str, Any]]:
    return store.keyword_rows(product_id, q, status, movement)


@app.get("/rank-radar/products/{product_id}/keywords/{keyword_id}/trend")
def keyword_trend(product_id: str, keyword_id: str) -> list[dict[str, Any]]:
    return store.trend(product_id, keyword_id)


@app.get("/rank-radar/products/{product_id}/keywords/{keyword_id}/variations")
def keyword_variations(product_id: str, keyword_id: str) -> list[dict[str, Any]]:
    return store.variations(product_id, keyword_id)


@app.get("/rank-radar/alerts")
def alerts(
    brandId: str | None = None,
    marketplace: str | None = None,
    productId: str | None = None,
    severity: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    return store.alerts({"brandId": brandId, "marketplace": marketplace, "productId": productId, "severity": severity, "status": status})


@app.post("/rank-radar/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: str) -> dict[str, Any]:
    row = store.update_alert_status(alert_id, "acknowledged")
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return row


@app.post("/rank-radar/alerts/{alert_id}/resolve")
def resolve(alert_id: str) -> dict[str, Any]:
    row = store.update_alert_status(alert_id, "resolved")
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return row


@app.get("/rank-radar/alert-rules")
def alert_rules() -> list[dict[str, Any]]:
    return store.alert_rules()


@app.post("/rank-radar/alert-rules")
async def add_alert_rule(payload: dict[str, Any]) -> dict[str, Any]:
    return store.add_alert_rule(payload)


@app.patch("/rank-radar/alert-rules/{rule_id}")
async def patch_alert_rule(rule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    # Compact starter implementation: create/update through same route to keep frontend flow stable.
    payload["id"] = rule_id
    return store.add_alert_rule(payload)


@app.post("/rank-radar/sync")
async def sync(brandId: str | None = None, marketplace: str | None = None) -> dict[str, Any]:
    return await run_sync(store, client, brand_id=brandId, marketplace=marketplace)


@app.get("/rank-radar/sync-runs")
def sync_runs() -> list[dict[str, Any]]:
    return store.sync_runs()

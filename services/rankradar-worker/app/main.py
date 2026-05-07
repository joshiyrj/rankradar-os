from __future__ import annotations

from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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

WEB_DIST = Path(__file__).resolve().parents[3] / "apps" / "web" / "dist"


@app.on_event("startup")
async def startup_sync() -> None:
    if settings.datadive_provider.lower() in {"live", "http", "datadive"} and not store.get_products(None, None):
        await run_sync(store, client)


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "rankradar-worker", "provider": settings.datadive_provider}


@app.get("/api/health")
def api_health() -> dict[str, Any]:
    return {"ok": True, "service": "rankradar-os", "worker": health()}


@app.get("/datadive/status")
def datadive_status() -> dict[str, Any]:
    return {
        "provider": settings.datadive_provider,
        "baseUrlConfigured": bool(settings.datadive_api_base_url),
        "apiKeyConfigured": bool(settings.datadive_api_key),
        "orgConfigured": bool(settings.datadive_org_id),
        "schedulerEnabled": settings.enable_scheduler,
    }


@app.get("/api/datadive/status")
def api_datadive_status() -> dict[str, Any]:
    return datadive_status()


@app.post("/datadive/test-connection")
async def test_connection() -> dict[str, Any]:
    try:
        return await client.test_connection()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/datadive/test-connection")
async def api_test_connection() -> dict[str, Any]:
    return await test_connection()


@app.get("/rank-radar/brands")
def brands() -> list[dict[str, Any]]:
    return store.list_brands()


@app.get("/api/rank-radar/brands")
def api_brands() -> list[dict[str, Any]]:
    return brands()


@app.get("/rank-radar/marketplaces")
def marketplaces(brandId: str | None = None) -> list[dict[str, Any]]:
    return store.list_marketplaces(brandId)


@app.get("/api/rank-radar/marketplaces")
def api_marketplaces(brandId: str | None = None) -> list[dict[str, Any]]:
    return marketplaces(brandId)


@app.get("/rank-radar/products")
def products(brandId: str | None = None, marketplace: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
    return store.get_products(brandId, marketplace, status)


@app.get("/api/rank-radar/products")
def api_products(brandId: str | None = None, marketplace: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
    return products(brandId, marketplace, status)


@app.get("/rank-radar/products/{product_id}")
def product(product_id: str) -> dict[str, Any]:
    header = store.product_header(product_id)
    if not header:
        raise HTTPException(status_code=404, detail="Product not found")
    return header


@app.get("/api/rank-radar/products/{product_id}")
def api_product(product_id: str) -> dict[str, Any]:
    return product(product_id)


@app.get("/rank-radar/products/{product_id}/summary")
def product_summary(product_id: str) -> dict[str, Any]:
    return store.product_summary(product_id)


@app.get("/api/rank-radar/products/{product_id}/summary")
def api_product_summary(product_id: str) -> dict[str, Any]:
    return product_summary(product_id)


@app.get("/rank-radar/products/{product_id}/keywords")
def product_keywords(product_id: str, q: str | None = None, status: str | None = None, movement: str | None = None) -> list[dict[str, Any]]:
    return store.keyword_rows(product_id, q, status, movement)


@app.get("/api/rank-radar/products/{product_id}/keywords")
def api_product_keywords(product_id: str, q: str | None = None, status: str | None = None, movement: str | None = None) -> list[dict[str, Any]]:
    return product_keywords(product_id, q, status, movement)


@app.get("/rank-radar/products/{product_id}/keywords/{keyword_id}/trend")
def keyword_trend(product_id: str, keyword_id: str) -> list[dict[str, Any]]:
    return store.trend(product_id, keyword_id)


@app.get("/api/rank-radar/products/{product_id}/keywords/{keyword_id}/trend")
def api_keyword_trend(product_id: str, keyword_id: str) -> list[dict[str, Any]]:
    return keyword_trend(product_id, keyword_id)


@app.get("/rank-radar/products/{product_id}/keywords/{keyword_id}/variations")
def keyword_variations(product_id: str, keyword_id: str) -> list[dict[str, Any]]:
    return store.variations(product_id, keyword_id)


@app.get("/api/rank-radar/products/{product_id}/keywords/{keyword_id}/variations")
def api_keyword_variations(product_id: str, keyword_id: str) -> list[dict[str, Any]]:
    return keyword_variations(product_id, keyword_id)


@app.get("/rank-radar/alerts")
def alerts(
    brandId: str | None = None,
    marketplace: str | None = None,
    productId: str | None = None,
    severity: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    return store.alerts({"brandId": brandId, "marketplace": marketplace, "productId": productId, "severity": severity, "status": status})


@app.get("/api/rank-radar/alerts")
def api_alerts(
    brandId: str | None = None,
    marketplace: str | None = None,
    productId: str | None = None,
    severity: str | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    return alerts(brandId, marketplace, productId, severity, status)


@app.post("/rank-radar/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: str) -> dict[str, Any]:
    row = store.update_alert_status(alert_id, "acknowledged")
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return row


@app.post("/api/rank-radar/alerts/{alert_id}/acknowledge")
def api_acknowledge(alert_id: str) -> dict[str, Any]:
    return acknowledge(alert_id)


@app.post("/rank-radar/alerts/{alert_id}/resolve")
def resolve(alert_id: str) -> dict[str, Any]:
    row = store.update_alert_status(alert_id, "resolved")
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return row


@app.post("/api/rank-radar/alerts/{alert_id}/resolve")
def api_resolve(alert_id: str) -> dict[str, Any]:
    return resolve(alert_id)


@app.get("/rank-radar/alert-rules")
def alert_rules() -> list[dict[str, Any]]:
    return store.alert_rules()


@app.get("/api/rank-radar/alert-rules")
def api_alert_rules() -> list[dict[str, Any]]:
    return alert_rules()


@app.post("/rank-radar/alert-rules")
async def add_alert_rule(payload: dict[str, Any]) -> dict[str, Any]:
    return store.add_alert_rule(payload)


@app.post("/api/rank-radar/alert-rules")
async def api_add_alert_rule(payload: dict[str, Any]) -> dict[str, Any]:
    return await add_alert_rule(payload)


@app.patch("/rank-radar/alert-rules/{rule_id}")
async def patch_alert_rule(rule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    # Compact starter implementation: create/update through same route to keep frontend flow stable.
    payload["id"] = rule_id
    return store.add_alert_rule(payload)


@app.patch("/api/rank-radar/alert-rules/{rule_id}")
async def api_patch_alert_rule(rule_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    return await patch_alert_rule(rule_id, payload)


@app.post("/rank-radar/sync")
async def sync(brandId: str | None = None, marketplace: str | None = None) -> dict[str, Any]:
    return await run_sync(store, client, brand_id=brandId, marketplace=marketplace)


@app.post("/api/rank-radar/sync")
async def api_sync(brandId: str | None = None, marketplace: str | None = None) -> dict[str, Any]:
    return await sync(brandId, marketplace)


@app.get("/rank-radar/sync-runs")
def sync_runs() -> list[dict[str, Any]]:
    return store.sync_runs()


@app.get("/api/rank-radar/sync-runs")
def api_sync_runs() -> list[dict[str, Any]]:
    return sync_runs()


if WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str) -> FileResponse:
    index = WEB_DIST / "index.html"
    if not index.exists():
        raise HTTPException(status_code=404, detail="Web app is not built. Run npm run build in apps/web.")
    requested = (WEB_DIST / full_path).resolve()
    if requested.is_file() and WEB_DIST.resolve() in requested.parents:
        return FileResponse(requested)
    return FileResponse(index)

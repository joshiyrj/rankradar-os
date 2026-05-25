from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .datadive_client import BaseDataDiveClient, HttpDataDiveClient
from .store import RankRadarStore


async def run_sync(
    store: RankRadarStore,
    client: BaseDataDiveClient,
    brand_id: str | None = None,
    marketplace: str | None = None,
) -> dict[str, Any]:
    """Run a DataDive ingestion pass.

    In mock mode the SQLite store is refreshed with deterministic seed data.
    In live mode, DataDive rank-radar products are normalized and stored.
    Raw API responses are captured and stored for audit/debugging (live only).
    """
    started = datetime.now(timezone.utc)
    sync_run_id = f"sync-{uuid4().hex[:12]}"
    is_live = isinstance(client, HttpDataDiveClient)
    provider = "live" if is_live else "mock"

    try:
        if is_live:
            products = await client.list_rank_radar_products(brand_id=brand_id, marketplace=marketplace)
            # Brands come from /v1/niches — if that endpoint fails, fall back gracefully
            # so the store can derive brand names from marketplace codes.
            try:
                brands = await client.list_brands()
            except Exception as brand_exc:  # noqa: BLE001
                print(f"[RankRadar] list_brands failed ({brand_exc}); brands will be derived from marketplace codes.")
                brands = []
            store.replace_live_rank_radars(products, brands=brands)
            inserted_alerts = 0
        else:
            store.upsert_seed_data()
            inserted_alerts = store.rebuild_alerts()
            products = []

        if is_live:
            _store_raw_responses(store, client, sync_run_id)

        run = store.record_sync_run(
            "success",
            sync_run_id=sync_run_id,
            records_processed=len(products),
            raw_context={
                "started": started.isoformat(),
                "provider": provider,
                "alertsGenerated": inserted_alerts,
                "brand_id": brand_id,
                "marketplace": marketplace,
            },
        )
        return {"ok": True, "syncRun": run, "productsSeen": len(products), "alertsGenerated": inserted_alerts}

    except Exception as exc:  # noqa: BLE001 — sync endpoints must always record failure
        if is_live:
            _store_raw_responses(store, client, sync_run_id)
        run = store.record_sync_run(
            "failed",
            sync_run_id=sync_run_id,
            error_message=str(exc),
            raw_context={
                "started": started.isoformat(),
                "brand_id": brand_id,
                "marketplace": marketplace,
            },
        )
        return {"ok": False, "syncRun": run, "error": str(exc)}


def _store_raw_responses(store: RankRadarStore, client: HttpDataDiveClient, sync_run_id: str) -> None:
    for entry in client.drain_raw_responses():
        try:
            store.insert_raw_api_response(
                endpoint=entry["endpoint"],
                request_params=entry.get("request_params"),
                response_body=entry.get("response_body"),
                status_code=entry.get("status_code", 0),
                sync_run_id=sync_run_id,
            )
        except Exception:  # noqa: BLE001 — never let audit logging break a sync
            pass

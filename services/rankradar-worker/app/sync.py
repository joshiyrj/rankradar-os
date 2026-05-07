from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .datadive_client import BaseDataDiveClient
from .store import RankRadarStore


async def run_sync(store: RankRadarStore, client: BaseDataDiveClient, brand_id: str | None = None, marketplace: str | None = None) -> dict[str, Any]:
    """Run an ingestion pass.

    In mock mode the SQLite store is refreshed with deterministic seed data. In live mode this method is the
    orchestration point where provider payloads can be normalized into the same schema.
    """
    started = datetime.now(timezone.utc)
    try:
        connection = await client.test_connection()
        products = await client.list_rank_radar_products(brand_id=brand_id, marketplace=marketplace)
        if connection.get("provider") == "mock":
            store.upsert_seed_data()
            processed = len(products)
        else:
            store.replace_live_rank_radars(products)
            processed = len(products)
        inserted_alerts = 0 if connection.get("provider") != "mock" else store.rebuild_alerts()
        run = store.record_sync_run(
            "success",
            records_processed=processed,
            raw_context={"started": started.isoformat(), "provider": connection.get("provider"), "alertsGenerated": inserted_alerts},
        )
        return {"ok": True, "syncRun": run, "productsSeen": processed, "alertsGenerated": inserted_alerts}
    except Exception as exc:  # noqa: BLE001 - sync endpoints should always record failure
        run = store.record_sync_run("failed", error_message=str(exc), raw_context={"started": started.isoformat()})
        return {"ok": False, "syncRun": run, "error": str(exc)}

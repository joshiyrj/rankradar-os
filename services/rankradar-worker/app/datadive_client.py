from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date, timedelta
from typing import Any
import httpx

from .demo_data import BRANDS, MARKETPLACES, PRODUCTS, VARIATIONS, KEYWORDS, generate_rank_records
from .settings import Settings


class DataDiveClientError(RuntimeError):
    pass


class BaseDataDiveClient(ABC):
    @abstractmethod
    async def test_connection(self) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def list_brands(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def list_marketplaces(self, brand_id: str | None = None) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def list_rank_radar_products(self, brand_id: str | None = None, marketplace: str | None = None) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def get_product_rank_radar(self, product_id: str, marketplace: str | None, date_from: str | None, date_to: str | None) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def get_variation_ranks(self, product_id: str, keyword_id: str, marketplace: str | None, date_from: str | None, date_to: str | None) -> list[dict[str, Any]]:
        raise NotImplementedError


class MockDataDiveClient(BaseDataDiveClient):
    async def test_connection(self) -> dict[str, Any]:
        return {"ok": True, "provider": "mock", "message": "Mock provider is active and ready."}

    async def list_brands(self) -> list[dict[str, Any]]:
        return BRANDS

    async def list_marketplaces(self, brand_id: str | None = None) -> list[dict[str, Any]]:
        if not brand_id:
            return MARKETPLACES
        marketplace_ids = {p["marketplace_id"] for p in PRODUCTS if p["brand_id"] == brand_id}
        return [m for m in MARKETPLACES if m["id"] in marketplace_ids]

    async def list_rank_radar_products(self, brand_id: str | None = None, marketplace: str | None = None) -> list[dict[str, Any]]:
        marketplace_by_code = {m["code"]: m["id"] for m in MARKETPLACES}
        rows = PRODUCTS
        if brand_id:
            rows = [p for p in rows if p["brand_id"] == brand_id]
        if marketplace:
            rows = [p for p in rows if p["marketplace_id"] == marketplace_by_code.get(marketplace, marketplace)]
        return rows

    async def get_product_rank_radar(self, product_id: str, marketplace: str | None, date_from: str | None, date_to: str | None) -> dict[str, Any]:
        ranks = [r for r in generate_rank_records() if r["product_id"] == product_id]
        if date_from:
            ranks = [r for r in ranks if r["rank_date"] >= date_from]
        if date_to:
            ranks = [r for r in ranks if r["rank_date"] <= date_to]
        return {
            "product": next((p for p in PRODUCTS if p["id"] == product_id), None),
            "variations": [v for v in VARIATIONS if v["product_id"] == product_id],
            "keywords": [k for k in KEYWORDS if k["id"] in {r["keyword_id"] for r in ranks}],
            "rank_records": ranks,
        }

    async def get_variation_ranks(self, product_id: str, keyword_id: str, marketplace: str | None, date_from: str | None, date_to: str | None) -> list[dict[str, Any]]:
        return [r for r in generate_rank_records() if r["product_id"] == product_id and r["keyword_id"] == keyword_id]


class HttpDataDiveClient(BaseDataDiveClient):
    """Configurable live DataDive adapter.

    Exact account-specific endpoint paths can be supplied with DATADIVE_ENDPOINT_* env vars.
    This keeps the code production-ready without hardcoding undocumented endpoints.
    """

    def __init__(self, settings: Settings):
        if not settings.datadive_api_key:
            raise DataDiveClientError("DATADIVE_API_KEY is required when DATADIVE_PROVIDER=live")
        if not settings.datadive_api_base_url:
            raise DataDiveClientError("DATADIVE_API_BASE_URL is required when DATADIVE_PROVIDER=live")
        self.settings = settings
        self._pending_raw_responses: list[dict[str, Any]] = []
        self.client = httpx.AsyncClient(
            base_url=settings.datadive_api_base_url.rstrip("/"),
            timeout=httpx.Timeout(30.0),
            headers={
                "x-api-key": settings.datadive_api_key,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

    def drain_raw_responses(self) -> list[dict[str, Any]]:
        """Return and clear all pending raw API responses accumulated since last drain."""
        pending = self._pending_raw_responses[:]
        self._pending_raw_responses.clear()
        return pending

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        clean_params = {k: v for k, v in (params or {}).items() if v not in (None, "")}
        response = await self.client.get(path, params=clean_params)
        body: Any = None
        try:
            body = response.json()
        except Exception:  # noqa: BLE001
            body = response.text[:2000]
        self._pending_raw_responses.append({
            "endpoint": path,
            "request_params": clean_params,
            "response_body": body,
            "status_code": response.status_code,
        })
        if response.status_code >= 400:
            raise DataDiveClientError(f"DataDive API returned {response.status_code}: {response.text[:500]}")
        return body

    def _items(self, payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            nested = payload.get("data")
            if isinstance(nested, dict):
                for key in ("data", "items", "results", "records"):
                    if isinstance(nested.get(key), list):
                        return nested[key]
            for key in ("data", "items", "results", "records"):
                if isinstance(payload.get(key), list):
                    return payload[key]
        return []

    async def test_connection(self) -> dict[str, Any]:
        brands = await self.list_brands()
        return {"ok": True, "provider": "live", "brandCount": len(brands), "message": "DataDive API responded successfully."}

    async def list_brands(self) -> list[dict[str, Any]]:
        products = await self.list_rank_radar_products()
        marketplaces = sorted({str(item.get("marketplace") or "com") for item in products})
        return [{"id": f"brand-datadive-{code}", "datadive_brand_id": code, "name": f"DataDive {code.upper()} Rank Radars"} for code in marketplaces] or [
            {"id": "brand-datadive", "datadive_brand_id": "datadive", "name": "DataDive Rank Radars"}
        ]

    async def list_marketplaces(self, brand_id: str | None = None) -> list[dict[str, Any]]:
        products = await self.list_rank_radar_products()
        codes = sorted({str(item.get("marketplace") or "com") for item in products})
        return [{"id": f"market-{code}", "code": code, "name": f"Amazon {code}", "amazon_domain": f"amazon.{code}"} for code in codes]

    async def list_rank_radar_products(self, brand_id: str | None = None, marketplace: str | None = None) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = await self._get(self.settings.endpoint_products, {"currentPage": page, "pageSize": 50, "status": "ALL"})
            page_rows = self._items(payload)
            rows.extend(page_rows)
            page_info = payload.get("data") if isinstance(payload.get("data"), dict) else payload
            if not isinstance(page_info, dict) or not page_info.get("hasNext"):
                break
            page += 1
        if marketplace:
            rows = [row for row in rows if str(row.get("marketplace")) == str(marketplace)]
        if brand_id and brand_id.startswith("brand-datadive-"):
            brand_marketplace = brand_id.replace("brand-datadive-", "", 1)
            rows = [row for row in rows if str(row.get("marketplace")) == brand_marketplace]
        return rows

    async def get_product_rank_radar(self, product_id: str, marketplace: str | None, date_from: str | None, date_to: str | None) -> dict[str, Any]:
        path = self.settings.endpoint_product_ranks.format(product_id=product_id)
        end = date_to or date.today().isoformat()
        start = date_from or (date.today() - timedelta(days=30)).isoformat()
        payload = await self._get(path, {"startDate": start, "endDate": end})
        return payload if isinstance(payload, dict) else {"rank_records": payload}

    async def get_variation_ranks(self, product_id: str, keyword_id: str, marketplace: str | None, date_from: str | None, date_to: str | None) -> list[dict[str, Any]]:
        path = self.settings.endpoint_variation_ranks.format(product_id=product_id, keyword_id=keyword_id)
        return self._items(await self._get(path, {"marketplace": marketplace, "dateFrom": date_from, "dateTo": date_to}))


def extract_sqp_fields(item: dict[str, Any]) -> dict[str, float | None]:
    """Extract Our ASIN Share / CTR / CVR from a DataDive API item.

    Tries multiple known field name conventions. Values are stored as decimals
    (0.125 = 12.5%). Returns None for each field when not found.

    DataDive field name candidates (update when confirmed against live API):
      our_asin_share: ourAsinShare, our_asin_share, asinShare, sqpAsinShare, clickShare
      our_ctr:        ourCtr, our_ctr, ctrOur, sqpCtr
      our_cvr:        ourCvr, our_cvr, cvrOur, sqpCvr, conversionRate
    """
    def _pick(keys: list[str]) -> float | None:
        for k in keys:
            v = item.get(k)
            if v is not None:
                try:
                    f = float(v)
                    # Normalize: if stored as percentage (e.g. 12.5) convert to decimal (0.125)
                    return f / 100.0 if f > 1.0 else f
                except (TypeError, ValueError):
                    pass
        return None

    return {
        "our_asin_share": _pick(["ourAsinShare", "our_asin_share", "asinShare", "sqpAsinShare", "clickShare"]),
        "our_ctr": _pick(["ourCtr", "our_ctr", "ctrOur", "sqpCtr"]),
        "our_cvr": _pick(["ourCvr", "our_cvr", "cvrOur", "sqpCvr"]),
    }


def make_client(settings: Settings) -> BaseDataDiveClient:
    if settings.datadive_provider.lower() in {"live", "http", "datadive"}:
        return HttpDataDiveClient(settings)
    return MockDataDiveClient()

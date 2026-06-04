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
        """Verify the API key works by fetching one page of products."""
        payload = await self._get(self.settings.endpoint_products, {"currentPage": 1, "pageSize": 1, "status": "ALL"})
        items = self._items(payload)
        return {
            "ok": True,
            "provider": "live",
            "message": "DataDive API responded successfully.",
            "productsAccessible": len(items) > 0,
        }

    async def list_brands(self) -> list[dict[str, Any]]:
        """Fetch real brand/niche names from /v1/niches with full pagination.

        Uses the same pagination pattern as list_rank_radar_products so the API
        receives the expected currentPage/pageSize parameters.
        Returns [] on empty response — callers fall back gracefully.
        """
        all_items: list[dict[str, Any]] = []
        page = 1
        while True:
            payload = await self._get(
                self.settings.endpoint_brands,
                {"currentPage": page, "pageSize": 50, "status": "ALL"},
            )
            items = self._items(payload)
            # If standard envelope keys miss, scan every value for a list of dicts
            if not items and isinstance(payload, dict):
                items = _first_list_of_dicts(payload)
            all_items.extend(items)
            page_info = payload.get("data") if isinstance(payload.get("data"), dict) else payload
            if not isinstance(page_info, dict) or not page_info.get("hasNext"):
                break
            page += 1
        return _parse_niche_items(all_items)

    async def list_marketplaces(self, brand_id: str | None = None) -> list[dict[str, Any]]:
        products = await self.list_rank_radar_products()
        if brand_id:
            products = _filter_by_brand(products, brand_id)
        codes = sorted({str(item.get("marketplace") or "com") for item in products})
        return [
            {
                "id": f"market-{code}",
                "code": code,
                "name": _marketplace_name(code),
                "amazon_domain": f"amazon.{code}",
            }
            for code in codes
        ]

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
        if brand_id:
            rows = _filter_by_brand(rows, brand_id)
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


_MARKETPLACE_NAMES: dict[str, str] = {
    "com": "Amazon.com",
    "co.uk": "Amazon.co.uk",
    "de": "Amazon.de",
    "fr": "Amazon.fr",
    "es": "Amazon.es",
    "it": "Amazon.it",
    "ca": "Amazon.ca",
    "au": "Amazon.com.au",
    "in": "Amazon.in",
    "jp": "Amazon.co.jp",
    "mx": "Amazon.com.mx",
    "sg": "Amazon.sg",
    "ae": "Amazon.ae",
    "sa": "Amazon.sa",
    "nl": "Amazon.nl",
    "pl": "Amazon.pl",
    "se": "Amazon.se",
    "br": "Amazon.com.br",
    "tr": "Amazon.com.tr",
}


def _marketplace_name(code: str) -> str:
    return _MARKETPLACE_NAMES.get(code, f"Amazon.{code}")


def _first_list_of_dicts(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Scan a dict for the first non-empty list of dicts (any depth, breadth-first)."""
    # Check top-level keys
    for val in payload.values():
        if isinstance(val, list) and val and isinstance(val[0], dict):
            return val
    # Check one level deeper (nested dicts)
    for val in payload.values():
        if isinstance(val, dict):
            for inner in val.values():
                if isinstance(inner, list) and inner and isinstance(inner[0], dict):
                    return inner
    return []


def _parse_niche_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert raw niche/brand API items to our internal brand format.

    Tries many possible field name conventions used by DataDive.
    """
    brands = []
    seen: set[str] = set()
    for item in items:
        niche_id = str(
            item.get("id") or item.get("nicheId") or item.get("niche_id")
            or item.get("_id") or item.get("ID") or ""
        )
        name = str(
            item.get("name") or item.get("nicheName") or item.get("niche_name")
            or item.get("title") or item.get("label") or item.get("displayName")
            or item.get("brandName") or item.get("brand_name") or niche_id
        )
        if niche_id and niche_id not in seen:
            seen.add(niche_id)
            brands.append({
                "id": f"brand-niche-{niche_id}",
                "datadive_brand_id": niche_id,
                "name": name,
            })
    return brands


def extract_brands_from_rank_radars(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Derive brands by grouping rank-radar products by their embedded niche data.

    Used as a last-resort fallback when /v1/niches returns nothing useful.
    Tries every plausible field name DataDive might use.
    """
    seen: dict[str, str] = {}  # niche_id → name
    for item in products:
        niche = item.get("niche") or {}
        if isinstance(niche, str):
            niche = {}
        niche_id = str(
            item.get("nicheId") or item.get("niche_id") or item.get("brand_id")
            or item.get("brandId") or niche.get("id") or niche.get("nicheId") or ""
        )
        niche_name = str(
            item.get("nicheName") or item.get("niche_name") or item.get("brandName")
            or item.get("brand_name") or niche.get("name") or niche.get("nicheName") or ""
        )
        if niche_id and niche_id not in seen and niche_name:
            seen[niche_id] = niche_name

    return [
        {"id": f"brand-niche-{nid}", "datadive_brand_id": nid, "name": name}
        for nid, name in seen.items()
    ]


def _filter_by_brand(rows: list[dict[str, Any]], brand_id: str) -> list[dict[str, Any]]:
    """Filter rank radar product rows by brand_id using nicheId or marketplace fallback."""
    if brand_id.startswith("brand-niche-"):
        niche_id = brand_id[len("brand-niche-"):]
        return [
            row for row in rows
            if str(row.get("nicheId") or row.get("niche_id") or row.get("niche", {}).get("id") or "") == niche_id
        ]
    if brand_id.startswith("brand-datadive-"):
        code = brand_id[len("brand-datadive-"):]
        return [row for row in rows if str(row.get("marketplace") or "com") == code]
    return rows


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

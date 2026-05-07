from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from pydantic import BaseModel, Field

Severity = Literal["critical", "high", "medium", "low", "positive"]
AlertStatus = Literal["open", "acknowledged", "resolved"]


class Brand(BaseModel):
    id: str
    datadive_brand_id: str
    name: str


class Marketplace(BaseModel):
    id: str
    code: str
    name: str
    amazon_domain: str | None = None


class Product(BaseModel):
    id: str
    datadive_product_id: str
    brand_id: str
    marketplace_id: str
    title: str
    asin: str
    parent_asin: str | None = None
    sku: str | None = None
    image_url: str | None = None
    last_synced_at: datetime | None = None


class ProductVariation(BaseModel):
    id: str
    product_id: str
    child_asin: str
    sku: str | None = None
    title: str | None = None
    variation_label: str | None = None
    image_url: str | None = None


class Keyword(BaseModel):
    id: str
    datadive_keyword_id: str
    keyword: str
    normalized_keyword: str
    search_volume: int | None = None
    priority: str = "standard"


class RankRecord(BaseModel):
    id: str
    product_id: str
    variation_id: str | None = None
    keyword_id: str
    marketplace_id: str
    rank_date: date
    day_name: str
    organic_rank: int | None = None
    previous_organic_rank: int | None = None
    rank_change: int | None = None
    sponsored_rank: int | None = None
    ppc_spend: float | None = None
    ppc_sales: float | None = None
    ppc_units: int | None = None
    impressions: int | None = None
    clicks: int | None = None
    ctr: float | None = None
    conversion_rate: float | None = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)


class RankAlert(BaseModel):
    id: str
    product_id: str
    variation_id: str | None = None
    keyword_id: str
    marketplace_id: str
    alert_type: str
    severity: Severity
    previous_rank: int | None = None
    current_rank: int | None = None
    rank_change: int | None = None
    status: AlertStatus = "open"
    detected_at: datetime
    acknowledged_at: datetime | None = None
    resolved_at: datetime | None = None
    raw_context: dict[str, Any] = Field(default_factory=dict)


class AlertRule(BaseModel):
    id: str
    scope_type: Literal["global", "brand", "marketplace", "product"]
    scope_id: str | None = None
    rule_type: str
    threshold_value: int
    enabled: bool = True


class SyncRun(BaseModel):
    id: str
    source: str
    status: str
    started_at: datetime
    completed_at: datetime | None = None
    records_processed: int = 0
    error_message: str | None = None
    raw_context: dict[str, Any] = Field(default_factory=dict)

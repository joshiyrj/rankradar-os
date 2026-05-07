from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parents[3]
SERVICE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(SERVICE_DIR / ".env", override=True)


def _bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    env: str = os.getenv("RANKRADAR_ENV", "development")
    db_path: str = os.getenv("RANKRADAR_DB_PATH", "./data/rankradar.sqlite3")
    datadive_provider: str = os.getenv("DATADIVE_PROVIDER", "live")
    datadive_api_key: str = os.getenv("DATADIVE_API_KEY", "")
    datadive_api_base_url: str = os.getenv("DATADIVE_API_BASE_URL", "https://api.datadive.tools")
    datadive_org_id: str = os.getenv("DATADIVE_ORG_ID", "")
    sync_interval_minutes: int = int(os.getenv("DATADIVE_SYNC_INTERVAL_MINUTES", "60"))
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongodb_db: str = os.getenv("MONGODB_DB", "rankradar-os")
    enable_scheduler: bool = _bool(os.getenv("RANKRADAR_ENABLE_SCHEDULER"), False)
    slack_webhook_url: str = os.getenv("SLACK_WEBHOOK_URL", "")
    email_to: str = os.getenv("ALERT_EMAIL_TO", "")
    whatsapp_webhook_url: str = os.getenv("WHATSAPP_WEBHOOK_URL", "")

    endpoint_brands: str = os.getenv("DATADIVE_ENDPOINT_BRANDS", "/v1/niches")
    endpoint_marketplaces: str = os.getenv("DATADIVE_ENDPOINT_MARKETPLACES", "/v1/niches")
    endpoint_products: str = os.getenv("DATADIVE_ENDPOINT_PRODUCTS", "/v1/niches/rank-radars")
    endpoint_product_ranks: str = os.getenv("DATADIVE_ENDPOINT_PRODUCT_RANKS", "/v1/niches/rank-radars/{product_id}")
    endpoint_variation_ranks: str = os.getenv("DATADIVE_ENDPOINT_VARIATION_RANKS", "/v1/niches/rank-radars/{product_id}")

    def ensure_dirs(self) -> None:
        Path(self.db_path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_dirs()
    return settings

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from random import Random

TODAY = date.today()
RNG = Random(42)

BRANDS = [
    {"id": "brand-orion", "datadive_brand_id": "dd-brand-orion", "name": "Orion Home"},
    {"id": "brand-luma", "datadive_brand_id": "dd-brand-luma", "name": "Luma Wellness"},
]

MARKETPLACES = [
    {"id": "mp-us", "code": "US", "name": "Amazon US", "amazon_domain": "amazon.com"},
    {"id": "mp-uk", "code": "UK", "name": "Amazon UK", "amazon_domain": "amazon.co.uk"},
    {"id": "mp-de", "code": "DE", "name": "Amazon Germany", "amazon_domain": "amazon.de"},
]

PRODUCTS = [
    {
        "id": "prod-air-purifier",
        "datadive_product_id": "dd-prod-air-purifier",
        "brand_id": "brand-orion",
        "marketplace_id": "mp-us",
        "title": "Orion PureFlow HEPA Air Purifier",
        "asin": "B0AIRPURA1",
        "parent_asin": "B0ORIONP01",
        "sku": "OR-PF-HEPA-US",
        "image_url": "https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=500&q=80",
    },
    {
        "id": "prod-desk-lamp",
        "datadive_product_id": "dd-prod-desk-lamp",
        "brand_id": "brand-orion",
        "marketplace_id": "mp-us",
        "title": "Orion Halo LED Desk Lamp",
        "asin": "B0HALOLED2",
        "parent_asin": "B0ORIONP02",
        "sku": "OR-HALO-US",
        "image_url": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=500&q=80",
    },
    {
        "id": "prod-sleep-oil",
        "datadive_product_id": "dd-prod-sleep-oil",
        "brand_id": "brand-luma",
        "marketplace_id": "mp-uk",
        "title": "Luma Calm Sleep Essential Oil Blend",
        "asin": "B0LUMASLP3",
        "parent_asin": "B0LUMAP01",
        "sku": "LU-CALM-UK",
        "image_url": "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=500&q=80",
    },
    {
        "id": "prod-yoga-mat",
        "datadive_product_id": "dd-prod-yoga-mat",
        "brand_id": "brand-luma",
        "marketplace_id": "mp-de",
        "title": "Luma Grip Pro Yoga Mat",
        "asin": "B0LUMAYOG4",
        "parent_asin": "B0LUMAP02",
        "sku": "LU-GRIP-DE",
        "image_url": "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=500&q=80",
    },
]

VARIATIONS = [
    {"id": "var-air-white", "product_id": "prod-air-purifier", "child_asin": "B0AIRWHTA1", "sku": "OR-PF-WHT", "title": "White", "variation_label": "White / Standard"},
    {"id": "var-air-black", "product_id": "prod-air-purifier", "child_asin": "B0AIRBLKA1", "sku": "OR-PF-BLK", "title": "Black", "variation_label": "Black / Standard"},
    {"id": "var-lamp-white", "product_id": "prod-desk-lamp", "child_asin": "B0HALOWHT2", "sku": "OR-HALO-WHT", "title": "Warm White", "variation_label": "Warm White"},
    {"id": "var-lamp-black", "product_id": "prod-desk-lamp", "child_asin": "B0HALOBLK2", "sku": "OR-HALO-BLK", "title": "Matte Black", "variation_label": "Matte Black"},
    {"id": "var-oil-10ml", "product_id": "prod-sleep-oil", "child_asin": "B0LUMA10ML", "sku": "LU-CALM-10", "title": "10ml", "variation_label": "10ml"},
    {"id": "var-oil-30ml", "product_id": "prod-sleep-oil", "child_asin": "B0LUMA30ML", "sku": "LU-CALM-30", "title": "30ml", "variation_label": "30ml"},
    {"id": "var-mat-blue", "product_id": "prod-yoga-mat", "child_asin": "B0LUMABLUE", "sku": "LU-GRIP-BLU", "title": "Ocean Blue", "variation_label": "Ocean Blue"},
    {"id": "var-mat-sage", "product_id": "prod-yoga-mat", "child_asin": "B0LUMASAGE", "sku": "LU-GRIP-SAG", "title": "Sage", "variation_label": "Sage"},
]

KEYWORDS = [
    {"id": "kw-air-purifier", "datadive_keyword_id": "dd-kw-air-purifier", "keyword": "air purifier", "normalized_keyword": "air purifier", "search_volume": 94300, "priority": "hero"},
    {"id": "kw-hepa-filter", "datadive_keyword_id": "dd-kw-hepa-filter", "keyword": "hepa air filter", "normalized_keyword": "hepa air filter", "search_volume": 21600, "priority": "core"},
    {"id": "kw-desk-lamp", "datadive_keyword_id": "dd-kw-desk-lamp", "keyword": "led desk lamp", "normalized_keyword": "led desk lamp", "search_volume": 38900, "priority": "hero"},
    {"id": "kw-study-light", "datadive_keyword_id": "dd-kw-study-light", "keyword": "study light", "normalized_keyword": "study light", "search_volume": 11200, "priority": "core"},
    {"id": "kw-sleep-oil", "datadive_keyword_id": "dd-kw-sleep-oil", "keyword": "sleep essential oil", "normalized_keyword": "sleep essential oil", "search_volume": 8400, "priority": "hero"},
    {"id": "kw-lavender-oil", "datadive_keyword_id": "dd-kw-lavender-oil", "keyword": "lavender oil for sleep", "normalized_keyword": "lavender oil for sleep", "search_volume": 15500, "priority": "core"},
    {"id": "kw-yoga-mat", "datadive_keyword_id": "dd-kw-yoga-mat", "keyword": "yoga mat", "normalized_keyword": "yoga mat", "search_volume": 121000, "priority": "hero"},
    {"id": "kw-non-slip-yoga", "datadive_keyword_id": "dd-kw-non-slip-yoga", "keyword": "non slip yoga mat", "normalized_keyword": "non slip yoga mat", "search_volume": 27400, "priority": "core"},
]

PRODUCT_KEYWORDS = {
    "prod-air-purifier": ["kw-air-purifier", "kw-hepa-filter"],
    "prod-desk-lamp": ["kw-desk-lamp", "kw-study-light"],
    "prod-sleep-oil": ["kw-sleep-oil", "kw-lavender-oil"],
    "prod-yoga-mat": ["kw-yoga-mat", "kw-non-slip-yoga"],
}


def generate_rank_records() -> list[dict]:
    rows: list[dict] = []
    for product in PRODUCTS:
        product_vars = [v for v in VARIATIONS if v["product_id"] == product["id"]]
        keyword_ids = PRODUCT_KEYWORDS[product["id"]]
        for kw_index, keyword_id in enumerate(keyword_ids):
            base = 8 + kw_index * 11 + RNG.randint(0, 6)
            previous_by_variation: dict[str, int] = {}
            for days_back in range(27, -1, -1):
                d = TODAY - timedelta(days=days_back)
                day_index = 27 - days_back
                for variation_index, variation in enumerate(product_vars):
                    trend = int(day_index * (-0.22 if kw_index == 0 else 0.08))
                    noise = RNG.randint(-3, 3)
                    shock = 0
                    # Intentionally create realistic drops/recoveries for alert demos.
                    if day_index in {18, 19} and variation_index == 1 and kw_index == 0:
                        shock = 12
                    if day_index == 23 and variation_index == 0 and kw_index == 1:
                        shock = 7
                    current = max(1, min(80, base + variation_index * 4 + trend + noise + shock))
                    previous = previous_by_variation.get(variation["id"])
                    previous_by_variation[variation["id"]] = current
                    rows.append({
                        "id": f"rr-{product['id']}-{variation['id']}-{keyword_id}-{d.isoformat()}",
                        "product_id": product["id"],
                        "variation_id": variation["id"],
                        "keyword_id": keyword_id,
                        "marketplace_id": product["marketplace_id"],
                        "rank_date": d.isoformat(),
                        "day_name": d.strftime("%A"),
                        "organic_rank": current,
                        "previous_organic_rank": previous,
                        "rank_change": None if previous is None else current - previous,
                        "sponsored_rank": max(1, current - RNG.randint(0, 10)) if RNG.random() > 0.22 else None,
                        "ppc_spend": round(RNG.uniform(5, 85), 2),
                        "ppc_sales": round(RNG.uniform(20, 420), 2),
                        "ppc_units": RNG.randint(0, 18),
                        "impressions": RNG.randint(600, 18000),
                        "clicks": RNG.randint(15, 380),
                        "ctr": round(RNG.uniform(0.01, 0.09), 4),
                        "conversion_rate": round(RNG.uniform(0.03, 0.22), 4),
                        "raw_payload": {"source": "mock", "note": "Deterministic demo rank radar payload"},
                    })
    return rows

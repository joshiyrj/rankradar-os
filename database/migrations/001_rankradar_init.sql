CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  datadive_brand_id TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketplaces (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  amazon_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  datadive_product_id TEXT UNIQUE,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  marketplace_id TEXT NOT NULL REFERENCES marketplaces(id),
  title TEXT NOT NULL,
  asin TEXT NOT NULL,
  parent_asin TEXT,
  sku TEXT,
  image_url TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variations (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  child_asin TEXT NOT NULL,
  sku TEXT,
  title TEXT,
  variation_label TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, child_asin)
);

CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY,
  datadive_keyword_id TEXT UNIQUE,
  keyword TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  search_volume INTEGER,
  priority TEXT DEFAULT 'standard',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rank_records (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variation_id TEXT REFERENCES product_variations(id),
  keyword_id TEXT NOT NULL REFERENCES keywords(id),
  marketplace_id TEXT NOT NULL REFERENCES marketplaces(id),
  rank_date DATE NOT NULL,
  day_name TEXT NOT NULL,
  organic_rank INTEGER,
  previous_organic_rank INTEGER,
  rank_change INTEGER,
  sponsored_rank INTEGER,
  ppc_spend NUMERIC(12,2),
  ppc_sales NUMERIC(12,2),
  ppc_units INTEGER,
  impressions INTEGER,
  clicks INTEGER,
  ctr NUMERIC(7,4),
  conversion_rate NUMERIC(7,4),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, variation_id, keyword_id, marketplace_id, rank_date)
);

CREATE TABLE IF NOT EXISTS rank_alerts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variation_id TEXT REFERENCES product_variations(id),
  keyword_id TEXT NOT NULL REFERENCES keywords(id),
  marketplace_id TEXT NOT NULL REFERENCES marketplaces(id),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  previous_rank INTEGER,
  current_rank INTEGER,
  rank_change INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  detected_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  raw_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, COALESCE(variation_id, ''), keyword_id, marketplace_id, alert_type, detected_at)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','brand','marketplace','product')),
  scope_id TEXT,
  rule_type TEXT NOT NULL,
  threshold_value INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  raw_context JSONB
);

CREATE INDEX IF NOT EXISTS idx_products_brand_marketplace ON products(brand_id, marketplace_id);
CREATE INDEX IF NOT EXISTS idx_rank_records_product_date ON rank_records(product_id, rank_date DESC);
CREATE INDEX IF NOT EXISTS idx_rank_records_keyword ON rank_records(keyword_id, rank_date DESC);
CREATE INDEX IF NOT EXISTS idx_rank_alerts_status ON rank_alerts(status, severity, detected_at DESC);

-- Migration 002: SQP overlay fields, new tables, alert status extensions
-- Version: 2.0.0
-- Apply after: 001_rankradar_init.sql

-- ─── Add SQP overlay fields to rank_records ─────────────────────────────────
ALTER TABLE rank_records ADD COLUMN IF NOT EXISTS our_asin_share REAL;
ALTER TABLE rank_records ADD COLUMN IF NOT EXISTS our_ctr REAL;
ALTER TABLE rank_records ADD COLUMN IF NOT EXISTS our_cvr REAL;
ALTER TABLE rank_records ADD COLUMN IF NOT EXISTS rank_bucket TEXT;

-- ─── New table: keyword_benchmarking_snapshots ───────────────────────────────
-- Stores Rank Radar SQP overlay metrics at keyword × date grain.
-- Percentages stored as decimals (e.g. 0.125 = 12.5%).
CREATE TABLE IF NOT EXISTS keyword_benchmarking_snapshots (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  keyword_id TEXT NOT NULL REFERENCES keywords(id),
  marketplace_id TEXT NOT NULL REFERENCES marketplaces(id),
  snapshot_date TEXT NOT NULL,
  our_asin_share REAL,        -- decimal: 0.125 = 12.5%
  our_ctr REAL,               -- decimal: 0.084 = 8.4%
  our_cvr REAL,               -- decimal: 0.142 = 14.2%
  datadive_source TEXT,       -- raw field name from DataDive API response
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, keyword_id, marketplace_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_kw_bench_product_date
  ON keyword_benchmarking_snapshots(product_id, snapshot_date DESC);

-- ─── New table: search_volume_snapshots ──────────────────────────────────────
-- Stores historical search volume by keyword × marketplace × date.
CREATE TABLE IF NOT EXISTS search_volume_snapshots (
  id TEXT PRIMARY KEY,
  keyword_id TEXT NOT NULL REFERENCES keywords(id),
  marketplace_id TEXT NOT NULL REFERENCES marketplaces(id),
  snapshot_date TEXT NOT NULL,
  search_volume INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (keyword_id, marketplace_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sv_snapshots_keyword_date
  ON search_volume_snapshots(keyword_id, snapshot_date DESC);

-- ─── New table: raw_api_responses ────────────────────────────────────────────
-- Stores raw DataDive API responses for debugging and audit.
CREATE TABLE IF NOT EXISTS raw_api_responses (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'datadive',
  endpoint TEXT NOT NULL,
  request_params JSONB,
  response_body JSONB,
  status_code INTEGER,
  sync_run_id TEXT REFERENCES sync_runs(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_api_responses_sync_run
  ON raw_api_responses(sync_run_id, created_at DESC);

-- ─── Alert status: add reviewed and ignored ───────────────────────────────────
-- PostgreSQL CHECK constraint update. SQLite does not enforce CHECK constraints
-- by default, so new statuses work without schema changes in SQLite.
ALTER TABLE rank_alerts DROP CONSTRAINT IF EXISTS rank_alerts_status_check;
ALTER TABLE rank_alerts ADD CONSTRAINT rank_alerts_status_check
  CHECK (status IN ('open', 'acknowledged', 'reviewed', 'ignored', 'resolved'));

-- ─── Indexes for new alert status values ─────────────────────────────────────
-- The existing idx_rank_alerts_status index already covers status queries.
-- No additional index needed.

-- Done.

-- PostgreSQL DDL Migration: 001_create_events_tables.sql
-- Workstream W1: Impression and Event Log

CREATE TABLE IF NOT EXISTS requests (
  request_id          UUID PRIMARY KEY,
  user_id             TEXT NOT NULL,
  endpoint            TEXT NOT NULL,
  params              JSONB,
  candidate_counts    JSONB,          -- per source, before/after filtering
  candidate_snapshot  JSONB,        -- top ~50 candidate ids + source + scores
  model_version       TEXT,
  embedding_version   TEXT,
  config_version      TEXT,
  experiment_id       TEXT,
  latency_ms          INT,
  served_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS impressions (
  impression_id       UUID PRIMARY KEY,
  request_id          UUID REFERENCES requests(request_id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  track_id            TEXT NOT NULL,
  position            SMALLINT NOT NULL,
  arm                 SMALLINT,
  source              TEXT,             -- persona_text, session_seed, graph, explore_band, resurface
  rank_in_source      INT,
  score_raw           REAL,
  score_fused         REAL,
  propensity          REAL,             -- P(arm at this slot), NULL until W9
  context             JSONB,            -- context vector AS SERVED
  preview_ok          BOOLEAN,          -- verified at serve time
  served_at           TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  event_id            UUID PRIMARY KEY, -- client-generated => idempotent
  impression_id       UUID REFERENCES impressions(impression_id) ON DELETE CASCADE,
  user_id             TEXT NOT NULL,
  track_id            TEXT NOT NULL,
  type                TEXT NOT NULL,    -- card_viewed, play_start, play_end, like, dislike, skip, save, open_external, preview_error, why_this_tap
  value_ms            INT,
  client_ts           TIMESTAMPTZ,
  server_ts           TIMESTAMPTZ DEFAULT now(),
  app_version         TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_user_served ON requests (user_id, served_at);
CREATE INDEX IF NOT EXISTS idx_impressions_user_served ON impressions (user_id, served_at);
CREATE INDEX IF NOT EXISTS idx_impressions_request ON impressions (request_id);
CREATE INDEX IF NOT EXISTS idx_events_impression ON events (impression_id);
CREATE INDEX IF NOT EXISTS idx_events_user_type ON events (user_id, type);

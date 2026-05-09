create table if not exists app_state (
  key text primary key,
  value text not null,
  updated_at text not null
);

create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at text not null
);

create table if not exists plans (
  title text primary key,
  content text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists skills (
  name text primary key,
  description text not null,
  body text not null,
  updated_at text not null
);

create table if not exists market_indexes (
  symbol text primary key,
  name text not null,
  value text not null,
  change real not null,
  updated_at text not null
);

create table if not exists articles (
  id text primary key,
  canonical_key text,
  provider text not null default 'unknown',
  query_lane text,
  title text not null,
  source text not null,
  url text not null unique,
  published_at text not null,
  country_code text not null,
  category text not null,
  summary text not null,
  market_reason text not null,
  weight real not null,
  weight_reason text,
  market_relevance integer not null default 0,
  lane_evidence_score integer not null default 0,
  accepted_for_analysis integer not null default 1,
  rejected_reason text,
  content_fingerprint text,
  raw_content text,
  created_at text not null
);

create index if not exists idx_articles_canonical_key on articles(canonical_key);
create index if not exists idx_articles_content_fingerprint on articles(content_fingerprint);
create index if not exists idx_articles_provider_lane on articles(provider, query_lane);
create index if not exists idx_articles_accepted on articles(accepted_for_analysis, published_at desc);

create table if not exists category_scores (
  id text primary key,
  country_code text not null,
  category text not null,
  score integer not null,
  summary text not null,
  impact_summary text not null,
  evidence_json text not null,
  updated_at text not null
);

create table if not exists chat_messages (
  id text primary key,
  thread_id text not null default 'default',
  role text not null,
  content text not null,
  context_ids_json text not null default '[]',
  created_at text not null
);

create table if not exists chat_threads (
  id text primary key,
  title text not null,
  summary text,
  archived integer not null default 0,
  created_at text not null,
  updated_at text not null
);

create table if not exists context_labels (
  context_key text primary key,
  source_label text not null,
  display_label text not null,
  created_at text not null,
  updated_at text not null
);

create table if not exists ingestion_runs (
  id text primary key,
  source text not null,
  started_at text not null,
  finished_at text,
  status text not null,
  notes text
);

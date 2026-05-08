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

create table if not exists articles (
  id text primary key,
  title text not null,
  source text not null,
  url text not null unique,
  published_at text not null,
  country_code text not null,
  category text not null,
  summary text not null,
  market_reason text not null,
  weight real not null,
  raw_content text,
  created_at text not null
);

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
  role text not null,
  content text not null,
  context_ids_json text not null default '[]',
  created_at text not null
);

create table if not exists ingestion_runs (
  id text primary key,
  source text not null,
  started_at text not null,
  finished_at text,
  status text not null,
  notes text
);

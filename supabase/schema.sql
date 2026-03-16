-- FounderOS — Supabase Schema
-- Run this in the Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- ── daily_tasks ──────────────────────────────────────────────────────────────
-- One row per (device, date, task). task_id "_done" marks the day complete.
create table if not exists daily_tasks (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  date        text not null,          -- "YYYY-MM-DD"
  task_id     text not null,          -- e.g. "ig_outreach", "pushups", "_done"
  value       integer not null default 0,
  updated_at  timestamptz not null default now(),
  unique (device_id, date, task_id)
);

-- ── call_logs ────────────────────────────────────────────────────────────────
create table if not exists call_logs (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  date        text not null,
  result      text not null,          -- "Closed", "Not Closed", etc.
  notes       text not null default '',
  time        text not null,          -- locale time string
  created_at  timestamptz not null default now()
);

-- ── ceo_logs ─────────────────────────────────────────────────────────────────
create table if not exists ceo_logs (
  id          uuid primary key default gen_random_uuid(),
  device_id   text not null,
  date        text not null,
  content     text not null default '',
  created_at  timestamptz not null default now()
);

-- ── streak_data ───────────────────────────────────────────────────────────────
create table if not exists streak_data (
  device_id   text primary key,
  streak      integer not null default 0,
  rank        integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ── fcm_tokens ────────────────────────────────────────────────────────────────
-- Stores push tokens so a backend (e.g. Supabase Edge Function) can send
-- scheduled notifications.
create table if not exists fcm_tokens (
  device_id   text primary key,
  token       text not null,
  updated_at  timestamptz not null default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- The app uses anonymous device IDs (no auth). Enable RLS and allow full
-- access via the anon key so the client can read/write its own rows.

alter table daily_tasks  enable row level security;
alter table call_logs    enable row level security;
alter table ceo_logs     enable row level security;
alter table streak_data  enable row level security;
alter table fcm_tokens   enable row level security;

-- Allow all operations from the anon (public) role
create policy "anon full access" on daily_tasks  for all to anon using (true) with check (true);
create policy "anon full access" on call_logs    for all to anon using (true) with check (true);
create policy "anon full access" on ceo_logs     for all to anon using (true) with check (true);
create policy "anon full access" on streak_data  for all to anon using (true) with check (true);
create policy "anon full access" on fcm_tokens   for all to anon using (true) with check (true);

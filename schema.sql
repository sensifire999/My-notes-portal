-- ============================================================
--  VIP-ANAND-7525 | Sentinel iNotes Ecosystem
--  Supabase Database Schema
--  Run this in your Supabase SQL Editor
-- ============================================================

-- 1. USERS TABLE
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  username    text unique not null,
  password    text not null,
  created_at  timestamptz default now()
);

-- 2. NOTES TABLE
--    subject has a UNIQUE constraint for upsert logic
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  subject     text unique not null,
  link        text not null,
  created_at  timestamptz default now()
);

-- 3. ACCESS KEYS TABLE
create table if not exists access_keys (
  id          uuid primary key default gen_random_uuid(),
  key_code    text unique not null,
  expiry_time timestamptz not null,
  is_used     boolean default false,
  used_by     text,
  used_at     timestamptz,
  created_at  timestamptz default now()
);

-- ── Row Level Security (optional but recommended) ──
alter table users       enable row level security;
alter table notes       enable row level security;
alter table access_keys enable row level security;

-- Allow full access via service role (used by Node backend)
create policy "Service full access - users"       on users       for all using (true);
create policy "Service full access - notes"       on notes       for all using (true);
create policy "Service full access - access_keys" on access_keys for all using (true);

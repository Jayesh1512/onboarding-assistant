-- Onboarding Assistant: persisted calls (run in Supabase SQL Editor or via CLI)

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ended_at timestamptz not null default now(),
  model text,
  transcript jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  summary text,
  utterance_count integer not null default 0,
  questions_asked_count integer not null default 0
);

create index if not exists calls_created_at_idx on public.calls (created_at desc);

comment on table public.calls is 'Onboarding calls: transcript lines, checklist Q&A snapshot, optional AI summary';

alter table public.calls enable row level security;

-- API routes use the service role key and bypass RLS. No public policies.

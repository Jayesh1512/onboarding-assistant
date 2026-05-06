alter table public.calls
  add column if not exists title text;

comment on column public.calls.title is 'AI-generated meeting title based on summary';

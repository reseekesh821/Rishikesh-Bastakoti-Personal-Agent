create table if not exists public.agent_state (
  agent_email text primary key,
  user_name text,
  state_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists agent_state_updated_at_idx
  on public.agent_state (updated_at desc);

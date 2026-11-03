begin;
create table public.portal_asten_webhook_inbox (
  fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$'),
  event jsonb not null check (jsonb_typeof(event)='object'),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index portal_asten_webhook_inbox_pending_idx on public.portal_asten_webhook_inbox(received_at) where processed_at is null;
alter table public.portal_asten_webhook_inbox enable row level security;
alter table public.portal_asten_webhook_inbox force row level security;
revoke all on public.portal_asten_webhook_inbox from public,anon,authenticated;
grant select,insert,update on public.portal_asten_webhook_inbox to service_role;
commit;

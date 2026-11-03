-- Solicitações de melhoria do Portal TCC.
-- O navegador nunca recebe credenciais do banco; somente a API institucional
-- grava e consulta os dados usando sua conexão privada.
create table if not exists public.portal_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  description text not null check (char_length(description) between 20 and 4000),
  image_mime text check (image_mime is null or image_mime in ('image/png','image/jpeg','image/webp')),
  image_base64 text check (image_base64 is null or char_length(image_base64) <= 2100000),
  image_size integer check (image_size is null or image_size between 1 and 1500000),
  ip_fingerprint text not null check (char_length(ip_fingerprint) = 64),
  status text not null default 'NEW' check (status in ('NEW','REVIEWED')),
  reviewed_at timestamptz,
  reviewed_by text,
  constraint portal_feedback_image_integrity check (
    (image_mime is null and image_base64 is null and image_size is null)
    or (image_mime is not null and image_base64 is not null and image_size is not null)
  )
);
create index if not exists portal_feedback_created_at_idx on public.portal_feedback(created_at desc);
create index if not exists portal_feedback_rate_idx on public.portal_feedback(ip_fingerprint,created_at desc);

alter table public.portal_feedback enable row level security;
alter table public.portal_feedback force row level security;
revoke all on table public.portal_feedback from public, anon, authenticated;
grant select, insert, update on table public.portal_feedback to service_role;
-- Nenhuma policy libera dados a usuários finais; a API do portal verifica o papel administrativo.
comment on table public.portal_feedback is 'Sugestões enviadas por visitantes. Acesso exclusivo via API institucional do Portal TCC.';

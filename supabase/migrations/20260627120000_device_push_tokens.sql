-- Tokens de notificaciones push de la app móvil (Expo). Cada miembro del equipo
-- registra el token de su dispositivo; el backend los usa para enviar avisos
-- (pagos pendientes, recordatorios de campus, etc.) vía la Expo Push API.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null default 'ios',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_push_tokens_user_id_idx on public.device_push_tokens (user_id);

-- RLS: cada usuario gestiona únicamente sus propios tokens. El backend (cron /
-- route handlers) lee con service role, que ignora RLS para enviar a todos.
alter table public.device_push_tokens enable row level security;

drop policy if exists "push tokens own select" on public.device_push_tokens;
drop policy if exists "push tokens own insert" on public.device_push_tokens;
drop policy if exists "push tokens own update" on public.device_push_tokens;
drop policy if exists "push tokens own delete" on public.device_push_tokens;

create policy "push tokens own select" on public.device_push_tokens
  for select using (user_id = auth.uid());
create policy "push tokens own insert" on public.device_push_tokens
  for insert with check (user_id = auth.uid());
create policy "push tokens own update" on public.device_push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push tokens own delete" on public.device_push_tokens
  for delete using (user_id = auth.uid());

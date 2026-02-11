create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

create table if not exists public.wheel_entries (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  used boolean not null default false,
  used_timestamp timestamptz null,
  winner boolean not null default false,
  winner_timestamp timestamptz null,
  spin_id uuid null
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  street text null,
  city text null,
  zip_code text not null,
  phone_number text not null,
  email_address text not null,
  follow_up_requested boolean not null,
  created_at timestamptz not null default now(),
  source text not null default 'publicForm',
  status text not null default 'new',
  wheel_entry_id uuid null,
  used boolean not null default false,
  used_timestamp timestamptz null,
  winner boolean not null default false,
  winner_timestamp timestamptz null,
  spin_id uuid null
);

alter table public.wheel_entries
  add constraint wheel_entries_lead_fk
  foreign key (lead_id) references public.leads(id) on delete cascade;

alter table public.leads
  add constraint leads_wheel_entry_fk
  foreign key (wheel_entry_id) references public.wheel_entries(id);

create table if not exists public.spins (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  entries_snapshot jsonb not null,
  winner_wheel_entry_id uuid not null,
  winner_display_name text not null,
  finalized_at timestamptz null,
  cancelled_at timestamptz null
);

create table if not exists public.locks (
  key text primary key,
  held_by uuid not null,
  spin_id uuid not null,
  expires_at timestamptz not null
);

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = p_user_id), false);
$$;

create or replace function public.create_public_lead(
  p_first_name text,
  p_last_name text,
  p_street text,
  p_city text,
  p_zip_code text,
  p_phone_number text,
  p_email_address text,
  p_follow_up_requested boolean,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid;
  v_wheel_entry_id uuid;
begin
  insert into public.leads (
    first_name,
    last_name,
    street,
    city,
    zip_code,
    phone_number,
    email_address,
    follow_up_requested
  )
  values (
    p_first_name,
    p_last_name,
    p_street,
    p_city,
    p_zip_code,
    p_phone_number,
    p_email_address,
    p_follow_up_requested
  )
  returning id into v_lead_id;

  insert into public.wheel_entries (lead_id, display_name)
  values (v_lead_id, p_display_name)
  returning id into v_wheel_entry_id;

  update public.leads
  set wheel_entry_id = v_wheel_entry_id
  where id = v_lead_id;

  return v_lead_id;
end;
$$;

create or replace function public.acquire_spin_lock(
  p_held_by uuid,
  p_spin_id uuid,
  p_ttl_seconds int default 120
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  insert into public.locks (key, held_by, spin_id, expires_at)
  values ('spinLock', p_held_by, p_spin_id, now() + make_interval(secs => p_ttl_seconds))
  on conflict (key)
  do update set
    held_by = excluded.held_by,
    spin_id = excluded.spin_id,
    expires_at = excluded.expires_at
  where public.locks.expires_at < now();

  select exists(
    select 1
    from public.locks
    where key = 'spinLock'
      and spin_id = p_spin_id
      and expires_at > now()
  ) into v_ok;

  return v_ok;
end;
$$;

create or replace function public.release_spin_lock(p_spin_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.locks where key = 'spinLock' and spin_id = p_spin_id;
$$;

create or replace function public.finalize_spin(
  p_spin_id uuid,
  p_confirm_winner boolean default true
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spin public.spins%rowtype;
begin
  select * into v_spin from public.spins where id = p_spin_id for update;

  if not found then
    raise exception 'spin not found';
  end if;

  if v_spin.status = 'finalized' then
    return 'already_finalized';
  end if;

  if v_spin.status = 'cancelled' then
    return 'cancelled';
  end if;

  update public.spins
  set status = 'finalizing'
  where id = p_spin_id;

  with snapshot as (
    select
      (elem->>'wheel_entry_id')::uuid as wheel_entry_id,
      (elem->>'lead_id')::uuid as lead_id
    from jsonb_array_elements(v_spin.entries_snapshot) elem
  )
  update public.wheel_entries we
  set
    used = true,
    used_timestamp = coalesce(we.used_timestamp, now()),
    spin_id = p_spin_id
  from snapshot s
  where we.id = s.wheel_entry_id;

  with snapshot as (
    select
      (elem->>'wheel_entry_id')::uuid as wheel_entry_id,
      (elem->>'lead_id')::uuid as lead_id
    from jsonb_array_elements(v_spin.entries_snapshot) elem
  )
  update public.leads l
  set
    used = true,
    used_timestamp = coalesce(l.used_timestamp, now()),
    spin_id = p_spin_id
  from snapshot s
  where l.id = s.lead_id;

  if p_confirm_winner then
    update public.wheel_entries
    set
      winner = true,
      winner_timestamp = coalesce(winner_timestamp, now()),
      spin_id = p_spin_id
    where id = v_spin.winner_wheel_entry_id;

    update public.leads
    set
      winner = true,
      winner_timestamp = coalesce(winner_timestamp, now()),
      spin_id = p_spin_id
    where wheel_entry_id = v_spin.winner_wheel_entry_id;
  end if;

  update public.spins
  set
    status = 'finalized',
    finalized_at = coalesce(finalized_at, now())
  where id = p_spin_id;

  delete from public.locks where key = 'spinLock' and spin_id = p_spin_id;

  return 'finalized';
end;
$$;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.wheel_entries enable row level security;
alter table public.spins enable row level security;
alter table public.locks enable row level security;

revoke all on public.profiles from anon;
revoke all on public.leads from anon;
revoke all on public.wheel_entries from anon;
revoke all on public.spins from anon;
revoke all on public.locks from anon;

create policy "profiles self read"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles self insert"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles self update"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

revoke execute on function public.create_public_lead(text, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.acquire_spin_lock(uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.release_spin_lock(uuid) from public, anon, authenticated;
revoke execute on function public.finalize_spin(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;

grant execute on function public.create_public_lead(text, text, text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.acquire_spin_lock(uuid, uuid, int) to service_role;
grant execute on function public.release_spin_lock(uuid) to service_role;
grant execute on function public.finalize_spin(uuid, boolean) to service_role;
grant execute on function public.is_admin(uuid) to service_role;

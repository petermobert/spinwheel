create table if not exists public.wheels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

drop function if exists public.create_public_lead(text, text, text, text, text, text, text, boolean, text);
drop function if exists public.acquire_spin_lock(uuid, uuid, int);
drop function if exists public.release_spin_lock(uuid);
drop function if exists public.finalize_spin(uuid, boolean);

insert into public.wheels (slug, name)
select 'default', 'Default Wheel'
where not exists (select 1 from public.wheels where slug = 'default');

alter table public.leads add column if not exists wheel_id uuid;
alter table public.wheel_entries add column if not exists wheel_id uuid;
alter table public.spins add column if not exists wheel_id uuid;
alter table public.locks add column if not exists wheel_id uuid;

update public.leads
set wheel_id = (select id from public.wheels where slug = 'default')
where wheel_id is null;

update public.wheel_entries
set wheel_id = (select id from public.wheels where slug = 'default')
where wheel_id is null;

update public.spins
set wheel_id = (select id from public.wheels where slug = 'default')
where wheel_id is null;

update public.locks
set wheel_id = (select id from public.wheels where slug = 'default')
where wheel_id is null;

alter table public.leads alter column wheel_id set not null;
alter table public.wheel_entries alter column wheel_id set not null;
alter table public.spins alter column wheel_id set not null;
alter table public.locks alter column wheel_id set not null;

alter table public.leads
  add constraint leads_wheel_fk
  foreign key (wheel_id) references public.wheels(id) on delete cascade;

alter table public.wheel_entries
  add constraint wheel_entries_wheel_fk
  foreign key (wheel_id) references public.wheels(id) on delete cascade;

alter table public.spins
  add constraint spins_wheel_fk
  foreign key (wheel_id) references public.wheels(id) on delete cascade;

alter table public.locks
  add constraint locks_wheel_fk
  foreign key (wheel_id) references public.wheels(id) on delete cascade;

alter table public.locks drop constraint if exists locks_pkey;
alter table public.locks add constraint locks_pkey primary key (wheel_id, key);

create or replace function public.create_public_lead(
  p_wheel_id uuid,
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
    follow_up_requested,
    wheel_id
  )
  values (
    p_first_name,
    p_last_name,
    p_street,
    p_city,
    p_zip_code,
    p_phone_number,
    p_email_address,
    p_follow_up_requested,
    p_wheel_id
  )
  returning id into v_lead_id;

  insert into public.wheel_entries (lead_id, display_name, wheel_id)
  values (v_lead_id, p_display_name, p_wheel_id)
  returning id into v_wheel_entry_id;

  update public.leads
  set wheel_entry_id = v_wheel_entry_id
  where id = v_lead_id;

  return v_lead_id;
end;
$$;

create or replace function public.acquire_spin_lock(
  p_wheel_id uuid,
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
  insert into public.locks (wheel_id, key, held_by, spin_id, expires_at)
  values (p_wheel_id, 'spinLock', p_held_by, p_spin_id, now() + make_interval(secs => p_ttl_seconds))
  on conflict (wheel_id, key)
  do update set
    held_by = excluded.held_by,
    spin_id = excluded.spin_id,
    expires_at = excluded.expires_at
  where public.locks.expires_at < now();

  select exists(
    select 1
    from public.locks
    where wheel_id = p_wheel_id
      and key = 'spinLock'
      and spin_id = p_spin_id
      and expires_at > now()
  ) into v_ok;

  return v_ok;
end;
$$;

create or replace function public.release_spin_lock(p_wheel_id uuid, p_spin_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.locks where wheel_id = p_wheel_id and key = 'spinLock' and spin_id = p_spin_id;
$$;

create or replace function public.finalize_spin(
  p_wheel_id uuid,
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
  select * into v_spin from public.spins where id = p_spin_id and wheel_id = p_wheel_id for update;

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

  delete from public.locks where wheel_id = p_wheel_id and key = 'spinLock' and spin_id = p_spin_id;

  return 'finalized';
end;
$$;

alter table public.wheels enable row level security;
revoke all on public.wheels from anon;

revoke execute on function public.create_public_lead(uuid, text, text, text, text, text, text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.acquire_spin_lock(uuid, uuid, uuid, int) from public, anon, authenticated;
revoke execute on function public.release_spin_lock(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.finalize_spin(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.create_public_lead(uuid, text, text, text, text, text, text, text, boolean, text) to service_role;
grant execute on function public.acquire_spin_lock(uuid, uuid, uuid, int) to service_role;
grant execute on function public.release_spin_lock(uuid, uuid) to service_role;
grant execute on function public.finalize_spin(uuid, uuid, boolean) to service_role;

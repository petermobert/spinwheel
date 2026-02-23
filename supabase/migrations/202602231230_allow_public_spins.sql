alter table public.spins alter column created_by drop not null;
alter table public.locks alter column held_by drop not null;

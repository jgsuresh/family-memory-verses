-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- 1) Put the TWO email addresses that may use the app below.
create table if not exists allowed_users (email text primary key);
insert into allowed_users (email) values
  ('joshua.suresh@gmail.com'),
  ('WIFE_EMAIL_HERE')
on conflict do nothing;

create table if not exists lists (
  id text primary key,
  name text not null,
  ord int not null,
  current_verse text
);

create table if not exists verses (
  id text primary key,
  list_id text not null references lists(id) on delete cascade,
  ord numeric not null,
  label text,
  ref text not null,
  body text not null,
  status text not null default 'todo' check (status in ('todo','learning','done')),
  review boolean not null default false,
  custom boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Spaced repetition state: one row per person per verse.
create table if not exists reviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  verse_id text not null references verses(id) on delete cascade,
  due timestamptz not null,
  interval_days real not null default 0,
  ease real not null default 2.5,
  reps int not null default 0,
  lapses int not null default 0,
  last_reviewed timestamptz,
  primary key (user_id, verse_id)
);

create or replace function is_member() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from allowed_users where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

alter table allowed_users enable row level security;   -- no policies: nobody can read it directly
alter table lists   enable row level security;
alter table verses  enable row level security;
alter table reviews enable row level security;

create policy "members use lists"  on lists  for all using (is_member()) with check (is_member());
create policy "members use verses" on verses for all using (is_member()) with check (is_member());
create policy "own reviews" on reviews for all
  using (is_member() and user_id = auth.uid())
  with check (is_member() and user_id = auth.uid());

-- Live updates between your two phones.
alter publication supabase_realtime add table lists, verses;

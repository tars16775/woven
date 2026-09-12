-- The public layer: accounts, reservations, founding-home applications,
-- contact notes and the opt-in health pings from Cores.
--
-- Nothing here is household data. Files, photos, cameras, memory and the
-- passkeys that open them live in a Core's own encrypted database, inside the
-- house. This is the part of Woven that exists before a box does: who asked
-- for one, and how to reach them.
--
-- Rows are written by the site API with the service key, which bypasses row
-- security, after it has validated and rate-limited the request. People read
-- their own rows through the policies below. There are no insert, update or
-- delete policies for signed-in users, so those are refused; the API is the
-- only writer.

-- ---------------------------------------------------------------------------
-- Accounts. auth.users is Supabase's; this is the part of a person we keep.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  name       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per Woven account. Deleted with the account.';

alter table public.profiles enable row level security;

create policy "people read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "people update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- A profile appears the moment an account does, so nothing else has to
-- remember to create one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Reservations from the configurator.
-- ---------------------------------------------------------------------------
create table public.reservations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code       text not null,
  tier       text not null,
  total      numeric(10, 2) not null,
  email      text,
  name       text,
  user_id    uuid references auth.users (id) on delete set null,
  status     text not null default 'received'
             check (status in ('received', 'confirmed', 'built', 'cancelled')),
  -- The whole submission as the site sent it: finish, storage, add-ons,
  -- deposit. Columns above are the parts we search and show; this is the rest.
  details    jsonb not null default '{}'::jsonb
);
comment on table public.reservations is 'A reservation from the configurator. Nothing is charged until a build slot is confirmed.';

create index reservations_created_idx on public.reservations (created_at desc);
create index reservations_user_idx    on public.reservations (user_id);
create index reservations_email_idx   on public.reservations (lower(email));

alter table public.reservations enable row level security;

-- Yours if you made it while signed in, or with the address you sign in with
-- now. The second clause is what lets a person see a reservation they made
-- before they had an account.
create policy "people read their own reservations"
  on public.reservations for select to authenticated
  using (
    user_id = auth.uid()
    or (email is not null and lower(email) = lower(auth.jwt() ->> 'email'))
  );

-- ---------------------------------------------------------------------------
-- Founding-home applications.
-- ---------------------------------------------------------------------------
create table public.applications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code       text not null,
  email      text not null,
  city       text not null,
  user_id    uuid references auth.users (id) on delete set null,
  status     text not null default 'received'
             check (status in ('received', 'reading', 'accepted', 'declined')),
  details    jsonb not null default '{}'::jsonb
);
comment on table public.applications is 'An application to the founding homes programme. Every one is read by a person.';

create index applications_created_idx on public.applications (created_at desc);
create index applications_user_idx    on public.applications (user_id);
create index applications_email_idx   on public.applications (lower(email));

alter table public.applications enable row level security;

create policy "people read their own applications"
  on public.applications for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------------
-- Contact notes.
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email      text not null,
  message    text not null,
  user_id    uuid references auth.users (id) on delete set null
);

create index contact_messages_created_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

create policy "people read their own messages"
  on public.contact_messages for select to authenticated
  using (user_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email'));

-- ---------------------------------------------------------------------------
-- Health pings from Cores that opted in: version, kind, uptime. No identifier
-- is stored and none is derived; the address a ping came from is not kept.
-- Nobody but the service reads these.
-- ---------------------------------------------------------------------------
create table public.core_pings (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  version    text not null,
  kind       text not null default 'unknown',
  up_days    integer
);
comment on table public.core_pings is 'Opt-in health pings. Deliberately has nothing that identifies a house.';

create index core_pings_created_idx on public.core_pings (created_at desc);

alter table public.core_pings enable row level security;

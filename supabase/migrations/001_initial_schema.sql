-- ============================================================
-- Migration 001: Initial schema
-- Paste this into Supabase SQL Editor and click Run
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---- Enums ----
create type user_role as enum ('admin', 'contractor', 'customer');
create type availability_status as enum ('available', 'partial', 'busy');
create type enquiry_status as enum ('new', 'read', 'responded', 'closed');
create type invite_status as enum ('pending', 'active', 'revoked');

-- ---- Profiles ----
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         user_role not null,
  full_name    text,
  company      text,
  created_at   timestamptz default now()
);

-- ---- Contractors ----
create table contractors (
  id                   uuid primary key default uuid_generate_v4(),
  profile_id           uuid not null references profiles(id) on delete cascade,
  alias                text not null,
  specialty            text not null,
  cv_summary           text,
  skills               text[],
  capability_file_url  text,
  active               boolean default true,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- ---- Contractor experience ----
create table contractor_experience (
  id              uuid primary key default uuid_generate_v4(),
  contractor_id   uuid not null references contractors(id) on delete cascade,
  year_range      text not null,
  description     text not null,
  sort_order      int default 0,
  created_at      timestamptz default now()
);

-- ---- Availability ----
create table availability (
  id              uuid primary key default uuid_generate_v4(),
  contractor_id   uuid not null references contractors(id) on delete cascade,
  date            date not null,
  status          availability_status not null,
  note            text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (contractor_id, date)
);

-- ---- Customer invites ----
create table customer_invites (
  id              uuid primary key default uuid_generate_v4(),
  email           text not null unique,
  company         text not null,
  status          invite_status default 'pending',
  invited_by      uuid references profiles(id),
  profile_id      uuid references profiles(id),
  created_at      timestamptz default now(),
  claimed_at      timestamptz
);

-- ---- Enquiries ----
create table enquiries (
  id              uuid primary key default uuid_generate_v4(),
  customer_id     uuid not null references profiles(id),
  contractor_id   uuid not null references contractors(id),
  preferred_dates text,
  message         text not null,
  contact_name    text,
  status          enquiry_status default 'new',
  admin_notes     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ---- Indexes ----
create index on availability (contractor_id, date);
create index on enquiries (status);
create index on enquiries (customer_id);
create index on customer_invites (email);
create index on customer_invites (status);

-- ---- Updated-at trigger ----
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger contractors_updated_at before update on contractors for each row execute function update_updated_at();
create trigger availability_updated_at before update on availability for each row execute function update_updated_at();
create trigger enquiries_updated_at before update on enquiries for each row execute function update_updated_at();

-- ---- Row Level Security ----
alter table profiles            enable row level security;
alter table contractors         enable row level security;
alter table contractor_experience enable row level security;
alter table availability        enable row level security;
alter table customer_invites    enable row level security;
alter table enquiries           enable row level security;

create or replace function my_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

-- profiles
create policy "Users read own profile" on profiles for select using (id = auth.uid());
create policy "Admins read all profiles" on profiles for select using (my_role() = 'admin');
create policy "Users update own profile" on profiles for update using (id = auth.uid());

-- contractors
create policy "Authenticated read contractors" on contractors for select using (active = true and auth.uid() is not null);
create policy "Contractors update own" on contractors for update using (profile_id = auth.uid());
create policy "Admins full contractors" on contractors for all using (my_role() = 'admin');

-- contractor_experience
create policy "Authenticated read experience" on contractor_experience for select using (auth.uid() is not null);
create policy "Contractors manage own experience" on contractor_experience for all using (contractor_id in (select id from contractors where profile_id = auth.uid()));
create policy "Admins full experience" on contractor_experience for all using (my_role() = 'admin');

-- availability
create policy "Authenticated read availability" on availability for select using (auth.uid() is not null);
create policy "Contractors manage own availability" on availability for all using (contractor_id in (select id from contractors where profile_id = auth.uid()));
create policy "Admins full availability" on availability for all using (my_role() = 'admin');

-- customer_invites
create policy "Admins manage invites" on customer_invites for all using (my_role() = 'admin');
create policy "Customer read own invite" on customer_invites for select using (profile_id = auth.uid() or email = (select email from auth.users where id = auth.uid()));

-- enquiries
create policy "Customers see own enquiries" on enquiries for select using (customer_id = auth.uid());
create policy "Customers insert enquiries" on enquiries for insert with check (customer_id = auth.uid() and my_role() = 'customer');
create policy "Admins full enquiries" on enquiries for all using (my_role() = 'admin');

-- ---- New user trigger (handles profile creation on signup) ----
create or replace function handle_new_user()
returns trigger as $$
declare v_invite customer_invites%rowtype;
begin
  if exists (select 1 from profiles where id = new.id) then return new; end if;

  select * into v_invite from customer_invites
  where email = new.email and status = 'pending' limit 1;

  if found then
    insert into profiles (id, role, full_name, company)
    values (new.id, 'customer', new.raw_user_meta_data->>'full_name', v_invite.company)
    on conflict (id) do nothing;

    update customer_invites set status = 'active', profile_id = new.id, claimed_at = now()
    where id = v_invite.id;
  else
    insert into profiles (id, role, full_name)
    values (new.id, 'contractor', new.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Complete the remote schema used by the Agenda Facil app and harden
-- Supabase access rules for the exposed public schema.

create schema if not exists extensions;

do $$
begin
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'btree_gist'
      and n.nspname = 'public'
  ) then
    alter extension btree_gist set schema extensions;
  end if;
end $$;

drop extension if exists pg_graphql;

alter table public.organizations
  add column if not exists plan_name text default 'starter',
  add column if not exists subscription_status text default 'active',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_end timestamptz;

alter table public.profiles
  add column if not exists photo_url text;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (role = any (array['owner', 'employee', 'customer', 'admin', 'staff']));
end $$;

create table if not exists public.customers (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(trim(name)) > 0),
  constraint customers_phone_not_blank check (length(trim(phone)) > 0),
  constraint customers_email_valid check (
    email is null
    or email = ''
    or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

alter table public.customers
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists company_id uuid references public.organizations(id) on delete cascade,
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.customers
set organization_id = coalesce(organization_id, company_id),
    company_id = coalesce(company_id, organization_id)
where organization_id is null
   or company_id is null;

alter table public.customers
  alter column organization_id set not null,
  alter column name set not null,
  alter column phone set not null;

create table if not exists public.promotions (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  name text not null,
  description text,
  discount_type text not null default 'percentage',
  discount_value numeric not null,
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_name_not_blank check (length(trim(name)) > 0),
  constraint promotions_discount_type_check check (discount_type in ('percentage', 'fixed')),
  constraint promotions_discount_value_check check (discount_value >= 0),
  constraint promotions_date_range_check check (end_date is null or end_date >= start_date)
);

create table if not exists public.waitlist (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  employee_id uuid references public.profiles(id) on delete set null,
  desired_date date not null,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_status_check check (status in ('pending', 'contacted', 'scheduled', 'cancelled'))
);

create table if not exists public.reviews (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  rating integer not null,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_appointment_unique unique (appointment_id)
);

create table if not exists public.password_reset_tokens (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_method text,
  add column if not exists amount_paid numeric not null default 0,
  add column if not exists promotion_id uuid,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists is_blocked boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_payment_status_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_payment_status_check
      check (payment_status in ('pending', 'paid', 'refunded'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_payment_method_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_payment_method_check
      check (
        payment_method is null
        or payment_method in ('credit_card', 'debit_card', 'pix', 'cash', 'online')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_amount_paid_nonnegative'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_amount_paid_nonnegative
      check (amount_paid >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_valid_time_range'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_valid_time_range
      check (end_time > start_time);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class src on src.oid = c.conrelid
    join pg_class tgt on tgt.oid = c.confrelid
    join pg_namespace src_ns on src_ns.oid = src.relnamespace
    join pg_namespace tgt_ns on tgt_ns.oid = tgt.relnamespace
    where c.conname = 'appointments_customer_id_fkey'
      and src_ns.nspname = 'public'
      and src.relname = 'appointments'
      and tgt_ns.nspname = 'public'
      and tgt.relname = 'profiles'
  ) then
    alter table public.appointments drop constraint appointments_customer_id_fkey;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_customer_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'appointments_promotion_id_fkey'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
      add constraint appointments_promotion_id_fkey
      foreign key (promotion_id)
      references public.promotions(id)
      on delete set null;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_customer_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.organization_id := coalesce(new.organization_id, new.company_id);
  new.company_id := coalesce(new.company_id, new.organization_id);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trigger_sync_customer_company_id on public.customers;
create trigger trigger_sync_customer_company_id
  before insert or update on public.customers
  for each row
  execute function public.sync_customer_company_id();

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
  before update on public.customers
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_promotions_updated_at on public.promotions;
create trigger set_promotions_updated_at
  before update on public.promotions
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_waitlist_updated_at on public.waitlist;
create trigger set_waitlist_updated_at
  before update on public.waitlist
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
  before update on public.reviews
  for each row
  execute function public.set_updated_at();

create index if not exists idx_organizations_owner_id
  on public.organizations (owner_id);

create index if not exists idx_profiles_organization_id
  on public.profiles (organization_id);

create index if not exists idx_services_organization_id
  on public.services (organization_id);

create unique index if not exists customers_organization_phone_unique
  on public.customers (organization_id, phone);

create index if not exists idx_customers_organization_name
  on public.customers (organization_id, name);

create index if not exists idx_customers_created_at
  on public.customers (created_at desc);

create index if not exists idx_appointments_organization_id
  on public.appointments (organization_id);

create index if not exists idx_appointments_customer_id
  on public.appointments (customer_id);

create index if not exists idx_appointments_service_id
  on public.appointments (service_id);

create index if not exists idx_appointments_org_start_time
  on public.appointments (organization_id, start_time);

create index if not exists idx_appointments_org_employee_start_time
  on public.appointments (organization_id, employee_id, start_time)
  where status <> 'cancelled';

create index if not exists idx_audit_logs_user_id
  on public.audit_logs (user_id);

create index if not exists idx_audit_logs_organization_id
  on public.audit_logs (organization_id);

create index if not exists idx_verification_codes_phone
  on public.verification_codes (phone);

create index if not exists idx_password_reset_tokens_token
  on public.password_reset_tokens (token)
  where used is false;

create index if not exists idx_password_reset_tokens_user_id
  on public.password_reset_tokens (user_id);

create index if not exists idx_promotions_organization_active
  on public.promotions (organization_id, active, start_date, end_date);

create index if not exists idx_promotions_service_id
  on public.promotions (service_id);

create index if not exists idx_waitlist_organization_status_date
  on public.waitlist (organization_id, status, desired_date);

create index if not exists idx_waitlist_customer_id
  on public.waitlist (customer_id);

create index if not exists idx_waitlist_service_id
  on public.waitlist (service_id);

create index if not exists idx_waitlist_employee_id
  on public.waitlist (employee_id);

create index if not exists idx_reviews_organization_id
  on public.reviews (organization_id);

create index if not exists idx_reviews_appointment_id
  on public.reviews (appointment_id);

create or replace function public.get_user_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.organization_id
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  v_full_name text;
  v_org_name text;
  v_org_slug text;
  v_role text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Usuario');
  v_org_name := nullif(new.raw_user_meta_data->>'org_name', '');
  v_org_slug := nullif(new.raw_user_meta_data->>'org_slug', '');
  v_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'owner');
  new_org_id := nullif(new.raw_user_meta_data->>'organization_id', '')::uuid;

  if new_org_id is null and v_role = 'owner' and v_org_slug is not null then
    insert into public.organizations (name, slug, owner_id)
    values (coalesce(v_org_name, 'Minha Empresa'), v_org_slug, new.id)
    returning id into new_org_id;
  end if;

  insert into public.profiles (id, organization_id, full_name, email, role)
  values (new.id, new_org_id, v_full_name, new.email, v_role)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = excluded.role,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.audit_trigger_func()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    insert into public.audit_logs(user_id, organization_id, action, table_name, record_id, old_data)
    values ((select auth.uid()), old.organization_id, 'delete', tg_table_name, old.id, row_to_json(old)::jsonb);
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into public.audit_logs(user_id, organization_id, action, table_name, record_id, old_data, new_data)
    values ((select auth.uid()), new.organization_id, 'update', tg_table_name, new.id, row_to_json(old)::jsonb, row_to_json(new)::jsonb);
    return new;
  elsif (tg_op = 'INSERT') then
    insert into public.audit_logs(user_id, organization_id, action, table_name, record_id, new_data)
    values ((select auth.uid()), new.organization_id, 'create', tg_table_name, new.id, row_to_json(new)::jsonb);
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists tr_audit_customers on public.customers;
create trigger tr_audit_customers
  after insert or update or delete on public.customers
  for each row
  execute function public.audit_trigger_func();

create or replace function public.request_otp(phone_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_phone text;
  generated_code text;
  expiry_time timestamptz;
begin
  clean_phone := regexp_replace(phone_number, '\D', '', 'g');
  generated_code := floor(random() * 900000 + 100000)::text;
  expiry_time := now() + interval '5 minutes';

  delete from public.verification_codes
  where phone = clean_phone
     or regexp_replace(phone, '\D', '', 'g') = clean_phone;

  insert into public.verification_codes (phone, code, expires_at)
  values (clean_phone, generated_code, expiry_time);

  return jsonb_build_object(
    'success', true,
    'message', 'Codigo enviado',
    'simulated_code', generated_code
  );
end;
$$;

create or replace function public.verify_otp(phone_number text, input_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_phone text;
  record_code record;
  customer_record record;
begin
  clean_phone := regexp_replace(phone_number, '\D', '', 'g');

  select * into record_code
  from public.verification_codes
  where regexp_replace(phone, '\D', '', 'g') = clean_phone
    and code = input_code
    and expires_at > now()
  order by created_at desc
  limit 1;

  if record_code is null then
    return jsonb_build_object('success', false, 'message', 'Codigo invalido ou expirado');
  end if;

  delete from public.verification_codes where id = record_code.id;

  select * into customer_record
  from public.customers
  where regexp_replace(phone, '\D', '', 'g') = clean_phone
  order by created_at desc
  limit 1;

  if customer_record is null then
    return jsonb_build_object('success', false, 'message', 'Cliente nao encontrado');
  end if;

  return jsonb_build_object(
    'success', true,
    'customer', jsonb_build_object(
      'id', customer_record.id,
      'name', customer_record.name,
      'phone', customer_record.phone,
      'organization_id', customer_record.organization_id
    )
  );
end;
$$;

create or replace function public.request_password_reset(user_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  user_record record;
  reset_token text;
  expiry_time timestamptz;
begin
  select id, email into user_record
  from auth.users
  where lower(email) = lower(user_email)
  limit 1;

  if user_record is null then
    return jsonb_build_object('success', true, 'message', 'Se o email existir, voce recebera instrucoes de recuperacao');
  end if;

  reset_token := encode(gen_random_bytes(32), 'hex');
  expiry_time := now() + interval '1 hour';

  update public.password_reset_tokens
  set used = true
  where user_id = user_record.id
    and used = false;

  insert into public.password_reset_tokens (user_id, token, expires_at)
  values (user_record.id, reset_token, expiry_time);

  return jsonb_build_object(
    'success', true,
    'message', 'Se o email existir, voce recebera instrucoes de recuperacao',
    'simulated_token', reset_token,
    'simulated_link', '/reset-password?token=' || reset_token
  );
end;
$$;

create or replace function public.verify_reset_token(reset_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record record;
begin
  select * into token_record
  from public.password_reset_tokens
  where token = reset_token
    and used = false
    and expires_at > now()
  limit 1;

  if token_record is null then
    return jsonb_build_object('success', false, 'message', 'Token invalido ou expirado');
  end if;

  return jsonb_build_object('success', true, 'user_id', token_record.user_id);
end;
$$;

create or replace function public.complete_password_reset(reset_token text, new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  token_record record;
begin
  select * into token_record
  from public.password_reset_tokens
  where token = reset_token
    and used = false
    and expires_at > now()
  limit 1;

  if token_record is null then
    return jsonb_build_object('success', false, 'message', 'Token invalido ou expirado');
  end if;

  update public.password_reset_tokens
  set used = true
  where id = token_record.id;

  return jsonb_build_object(
    'success', true,
    'message', 'Token validado. Atualize a senha pelo fluxo de Auth do Supabase.',
    'user_id', token_record.user_id
  );
end;
$$;

create or replace function public.check_availability(
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_organization_id uuid,
  p_employee_id uuid default null,
  p_exclude_appointment_id uuid default null
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1
    from public.appointments a
    where a.organization_id = p_organization_id
      and a.status <> 'cancelled'
      and (p_exclude_appointment_id is null or a.id <> p_exclude_appointment_id)
      and (p_employee_id is null or a.employee_id = p_employee_id)
      and a.start_time < p_end_time
      and a.end_time > p_start_time
  );
$$;

create or replace function public.get_customer_appointments(p_customer_id uuid)
returns table (
  id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  service_name text,
  service_price numeric,
  service_duration integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    a.id,
    a.start_time,
    a.end_time,
    a.status,
    s.name as service_name,
    s.price as service_price,
    s.duration_minutes as service_duration
  from public.appointments a
  left join public.services s on s.id = a.service_id
  where a.customer_id = p_customer_id
  order by a.start_time desc;
$$;

drop function if exists public.get_monthly_revenue(uuid);
drop function if exists public.get_top_services(uuid);
drop function if exists public.get_peak_hours(uuid);
drop function if exists public.get_dashboard_stats(uuid);

create function public.get_monthly_revenue(organization_id uuid)
returns table (month text, revenue numeric)
language sql
security invoker
stable
set search_path = public
as $$
  select
    to_char(a.start_time, 'YYYY-MM') as month,
    coalesce(sum(coalesce(a.amount_paid, s.price)), 0)::numeric as revenue
  from public.appointments a
  left join public.services s on s.id = a.service_id
  where a.organization_id = $1
    and a.status = 'completed'
    and a.start_time >= now() - interval '6 months'
  group by to_char(a.start_time, 'YYYY-MM')
  order by month desc;
$$;

create function public.get_top_services(organization_id uuid)
returns table (service_name text, count bigint, revenue numeric)
language sql
security invoker
stable
set search_path = public
as $$
  select
    coalesce(s.name, 'Servico removido') as service_name,
    count(*)::bigint as count,
    coalesce(sum(coalesce(a.amount_paid, s.price)), 0)::numeric as revenue
  from public.appointments a
  left join public.services s on s.id = a.service_id
  where a.organization_id = $1
    and a.status in ('completed', 'confirmed')
  group by coalesce(s.name, 'Servico removido')
  order by count desc
  limit 5;
$$;

create function public.get_peak_hours(organization_id uuid)
returns table (hour text, appointments bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    to_char(a.start_time, 'HH24:00') as hour,
    count(*)::bigint as appointments
  from public.appointments a
  where a.organization_id = $1
    and a.status in ('completed', 'confirmed')
  group by to_char(a.start_time, 'HH24:00')
  order by hour;
$$;

create function public.get_dashboard_stats(organization_id uuid)
returns table (
  total_appointments bigint,
  total_customers bigint,
  total_revenue numeric,
  avg_ticket numeric
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    (select count(*) from public.appointments a where a.organization_id = $1 and a.status = 'completed')::bigint,
    (select count(*) from public.customers c where c.organization_id = $1)::bigint,
    (
      select coalesce(sum(coalesce(a.amount_paid, s.price)), 0)
      from public.appointments a
      left join public.services s on s.id = a.service_id
      where a.organization_id = $1
        and a.status = 'completed'
    )::numeric,
    (
      select coalesce(avg(coalesce(a.amount_paid, s.price)), 0)
      from public.appointments a
      left join public.services s on s.id = a.service_id
      where a.organization_id = $1
        and a.status = 'completed'
    )::numeric;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.appointments enable row level security;
alter table public.customers enable row level security;
alter table public.promotions enable row level security;
alter table public.waitlist enable row level security;
alter table public.reviews enable row level security;
alter table public.verification_codes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.password_reset_tokens enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations',
        'profiles',
        'services',
        'appointments',
        'customers',
        'promotions',
        'waitlist',
        'reviews',
        'audit_logs'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

create policy organizations_select_public
on public.organizations
for select
to anon
using (true);

create policy organizations_select_authenticated
on public.organizations
for select
to authenticated
using (
  id = (select public.get_user_organization_id())
  or (select public.get_user_organization_id()) is null
);

create policy organizations_insert_authenticated
on public.organizations
for insert
to authenticated
with check ((select auth.uid()) is not null);

create policy organizations_update_authenticated
on public.organizations
for update
to authenticated
using (id = (select public.get_user_organization_id()))
with check (id = (select public.get_user_organization_id()));

create policy profiles_select_public
on public.profiles
for select
to anon
using (
  organization_id is not null
  and role in ('owner', 'admin', 'employee', 'staff')
);

create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or organization_id = (select public.get_user_organization_id())
);

create policy profiles_insert_authenticated
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  or organization_id = (select public.get_user_organization_id())
);

create policy profiles_update_authenticated
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
  or organization_id = (select public.get_user_organization_id())
  or (
    organization_id is null
    and (select public.get_user_organization_id()) is not null
  )
)
with check (
  id = (select auth.uid())
  or organization_id = (select public.get_user_organization_id())
  or organization_id is null
);

create policy profiles_delete_authenticated
on public.profiles
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy services_select_public
on public.services
for select
to anon
using (is_active is true);

create policy services_select_authenticated
on public.services
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy services_insert_authenticated
on public.services
for insert
to authenticated
with check (organization_id = (select public.get_user_organization_id()));

create policy services_update_authenticated
on public.services
for update
to authenticated
using (organization_id = (select public.get_user_organization_id()))
with check (organization_id = (select public.get_user_organization_id()));

create policy services_delete_authenticated
on public.services
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy appointments_insert_public
on public.appointments
for insert
to anon
with check (
  organization_id is not null
  and status = 'pending'
  and end_time > start_time
  and (payment_status is null or payment_status = 'pending')
  and coalesce(amount_paid, 0) = 0
  and (
    service_id is null
    or exists (
      select 1
      from public.services s
      where s.id = service_id
        and s.organization_id = appointments.organization_id
        and s.is_active is true
    )
  )
  and (
    employee_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = employee_id
        and p.organization_id = appointments.organization_id
        and p.role in ('owner', 'admin', 'employee', 'staff')
    )
  )
);

create policy appointments_select_authenticated
on public.appointments
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy appointments_insert_authenticated
on public.appointments
for insert
to authenticated
with check (organization_id = (select public.get_user_organization_id()));

create policy appointments_update_authenticated
on public.appointments
for update
to authenticated
using (organization_id = (select public.get_user_organization_id()))
with check (organization_id = (select public.get_user_organization_id()));

create policy appointments_delete_authenticated
on public.appointments
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy customers_select_authenticated
on public.customers
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy customers_insert_authenticated
on public.customers
for insert
to authenticated
with check (organization_id = (select public.get_user_organization_id()));

create policy customers_update_authenticated
on public.customers
for update
to authenticated
using (organization_id = (select public.get_user_organization_id()))
with check (organization_id = (select public.get_user_organization_id()));

create policy customers_delete_authenticated
on public.customers
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy promotions_select_authenticated
on public.promotions
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy promotions_insert_authenticated
on public.promotions
for insert
to authenticated
with check (organization_id = (select public.get_user_organization_id()));

create policy promotions_update_authenticated
on public.promotions
for update
to authenticated
using (organization_id = (select public.get_user_organization_id()))
with check (organization_id = (select public.get_user_organization_id()));

create policy promotions_delete_authenticated
on public.promotions
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy waitlist_select_authenticated
on public.waitlist
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy waitlist_insert_authenticated
on public.waitlist
for insert
to authenticated
with check (organization_id = (select public.get_user_organization_id()));

create policy waitlist_update_authenticated
on public.waitlist
for update
to authenticated
using (organization_id = (select public.get_user_organization_id()))
with check (organization_id = (select public.get_user_organization_id()));

create policy waitlist_delete_authenticated
on public.waitlist
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy reviews_select_authenticated
on public.reviews
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy reviews_insert_authenticated
on public.reviews
for insert
to authenticated
with check (organization_id = (select public.get_user_organization_id()));

create policy reviews_update_authenticated
on public.reviews
for update
to authenticated
using (organization_id = (select public.get_user_organization_id()))
with check (organization_id = (select public.get_user_organization_id()));

create policy reviews_delete_authenticated
on public.reviews
for delete
to authenticated
using (organization_id = (select public.get_user_organization_id()));

create policy audit_logs_select_authenticated
on public.audit_logs
for select
to authenticated
using (organization_id = (select public.get_user_organization_id()));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select (id, name, slug, primary_color, secondary_color, accent_color, logo_url)
  on public.organizations to anon;
grant select (id, organization_id, name, description, price, duration_minutes, category, is_active)
  on public.services to anon;
grant select (id, organization_id, full_name, role, avatar_url, photo_url)
  on public.profiles to anon;
grant insert (
  organization_id,
  customer_id,
  employee_id,
  service_id,
  customer_name,
  customer_phone,
  start_time,
  end_time,
  status,
  notes,
  payment_status,
  amount_paid
) on public.appointments to anon;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.promotions to authenticated;
grant select, insert, update, delete on public.waitlist to authenticated;
grant select, insert, update, delete on public.reviews to authenticated;
grant select on public.audit_logs to authenticated;

grant execute on function public.get_user_organization_id() to authenticated;
grant execute on function public.request_otp(text) to anon, authenticated;
grant execute on function public.verify_otp(text, text) to anon, authenticated;
grant execute on function public.request_password_reset(text) to anon, authenticated;
grant execute on function public.verify_reset_token(text) to anon, authenticated;
grant execute on function public.complete_password_reset(text, text) to anon, authenticated;
grant execute on function public.check_availability(timestamptz, timestamptz, uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.get_customer_appointments(uuid) to anon, authenticated;
grant execute on function public.get_monthly_revenue(uuid) to authenticated;
grant execute on function public.get_top_services(uuid) to authenticated;
grant execute on function public.get_peak_hours(uuid) to authenticated;
grant execute on function public.get_dashboard_stats(uuid) to authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'logos',
    'logos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
  ),
  (
    'employee-photos',
    'employee-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_public_read on storage.objects;
drop policy if exists logos_upload on storage.objects;
drop policy if exists logos_update on storage.objects;
drop policy if exists logos_delete on storage.objects;
drop policy if exists logos_select_authenticated on storage.objects;
drop policy if exists logos_insert_authenticated on storage.objects;
drop policy if exists logos_update_authenticated on storage.objects;
drop policy if exists logos_delete_authenticated on storage.objects;
drop policy if exists employee_photos_select on storage.objects;
drop policy if exists employee_photos_insert on storage.objects;
drop policy if exists employee_photos_update on storage.objects;
drop policy if exists employee_photos_delete on storage.objects;

create policy logos_select_authenticated
on storage.objects
for select
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy logos_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy logos_update_authenticated
on storage.objects
for update
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
)
with check (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy logos_delete_authenticated
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'logos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy employee_photos_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'employee-photos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy employee_photos_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'employee-photos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy employee_photos_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'employee-photos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
)
with check (
  bucket_id = 'employee-photos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

create policy employee_photos_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'employee-photos'
  and (storage.foldername(name))[1] = (select public.get_user_organization_id())::text
);

comment on table public.customers is 'CRM customers linked to an organization.';
comment on table public.promotions is 'Organization promotions for services.';
comment on table public.waitlist is 'Customer waitlist entries for desired dates.';
comment on table public.reviews is 'Appointment reviews and ratings.';
comment on table public.password_reset_tokens is 'Short-lived password reset tokens used by the app recovery flow.';

notify pgrst, 'reload schema';

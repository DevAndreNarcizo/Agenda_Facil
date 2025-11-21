-- Create customers table
create table if not exists public.customers (
  id uuid default gen_random_uuid() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  name text not null,
  phone text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.customers enable row level security;

-- Policies for Customers
drop policy if exists "Users can view customers in own organization" on public.customers;
create policy "Users can view customers in own organization"
  on public.customers for select
  using (
    organization_id = public.get_auth_user_org_id()
  );

drop policy if exists "Users can insert customers in own organization" on public.customers;
create policy "Users can insert customers in own organization"
  on public.customers for insert
  with check (
    organization_id = public.get_auth_user_org_id()
  );

drop policy if exists "Users can update customers in own organization" on public.customers;
create policy "Users can update customers in own organization"
  on public.customers for update
  using (
    organization_id = public.get_auth_user_org_id()
  );

-- Update appointments table to link to customers
alter table public.appointments 
add column if not exists customer_id uuid references public.customers on delete set null;

-- Index for faster lookups
create index if not exists idx_customers_org_id on public.customers(organization_id);
create index if not exists idx_appointments_customer_id on public.appointments(customer_id);

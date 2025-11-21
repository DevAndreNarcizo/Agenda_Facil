-- Create a table for companies
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for user profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  company_id uuid references public.companies on delete cascade not null,
  role text not null check (role in ('admin', 'employee')),
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.companies enable row level security;
alter table public.profiles enable row level security;

-- Policies for Companies
drop policy if exists "Users can insert companies" on public.companies;
create policy "Users can insert companies"
  on public.companies for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Users can view own company" on public.companies;
create policy "Users can view own company"
  on public.companies for select
  using (
    id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

-- Policies for Profiles
drop policy if exists "Users can view profiles in own company" on public.profiles;
create policy "Users can view profiles in own company"
  on public.profiles for select
  using (
    company_id in (
      select company_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (
    auth.uid() = id
  );

drop policy if exists "Admins can insert employee profiles" on public.profiles;
create policy "Admins can insert employee profiles"
  on public.profiles for insert
  with check (
    exists (
      select 1 from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
      and admin_profile.company_id = profiles.company_id
    )
  );

drop policy if exists "Admins can update profiles in own company" on public.profiles;
create policy "Admins can update profiles in own company"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles as admin_profile
      where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
      and admin_profile.company_id = profiles.company_id
    )
  );

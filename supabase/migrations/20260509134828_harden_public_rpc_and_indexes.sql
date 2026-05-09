-- Keep public RPC names stable while moving privileged work behind a
-- non-exposed schema. Also add the FK indexes reported after the first pass.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create index if not exists idx_appointments_promotion_id
  on public.appointments (promotion_id);

create index if not exists idx_customers_company_id
  on public.customers (company_id);

create or replace function private.get_user_organization_id()
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

create or replace function private.request_otp(phone_number text)
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

create or replace function private.verify_otp(phone_number text, input_code text)
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

create or replace function private.request_password_reset(user_email text)
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

create or replace function private.verify_reset_token(reset_token text)
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

create or replace function private.complete_password_reset(reset_token text, new_password text)
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

create or replace function private.check_availability(
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

create or replace function private.get_customer_appointments(p_customer_id uuid)
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

create or replace function public.get_user_organization_id()
returns uuid
language sql
security invoker
stable
set search_path = public, private
as $$
  select private.get_user_organization_id();
$$;

create or replace function public.request_otp(phone_number text)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.request_otp(phone_number);
$$;

create or replace function public.verify_otp(phone_number text, input_code text)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.verify_otp(phone_number, input_code);
$$;

create or replace function public.request_password_reset(user_email text)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.request_password_reset(user_email);
$$;

create or replace function public.verify_reset_token(reset_token text)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.verify_reset_token(reset_token);
$$;

create or replace function public.complete_password_reset(reset_token text, new_password text)
returns jsonb
language sql
security invoker
set search_path = public, private
as $$
  select private.complete_password_reset(reset_token, new_password);
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
security invoker
stable
set search_path = public, private
as $$
  select private.check_availability(
    p_start_time,
    p_end_time,
    p_organization_id,
    p_employee_id,
    p_exclude_appointment_id
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
security invoker
stable
set search_path = public, private
as $$
  select *
  from private.get_customer_appointments(p_customer_id);
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.get_user_organization_id() to authenticated;
grant execute on function private.request_otp(text) to anon;
grant execute on function private.verify_otp(text, text) to anon;
grant execute on function private.request_password_reset(text) to anon;
grant execute on function private.verify_reset_token(text) to anon;
grant execute on function private.complete_password_reset(text, text) to anon;
grant execute on function private.check_availability(timestamptz, timestamptz, uuid, uuid, uuid) to anon;
grant execute on function private.get_customer_appointments(uuid) to anon;

revoke execute on function public.request_otp(text) from authenticated;
revoke execute on function public.verify_otp(text, text) from authenticated;
revoke execute on function public.request_password_reset(text) from authenticated;
revoke execute on function public.verify_reset_token(text) from authenticated;
revoke execute on function public.complete_password_reset(text, text) from authenticated;
revoke execute on function public.check_availability(timestamptz, timestamptz, uuid, uuid, uuid) from authenticated;
revoke execute on function public.get_customer_appointments(uuid) from authenticated;

drop policy if exists verification_codes_no_direct_access on public.verification_codes;
create policy verification_codes_no_direct_access
on public.verification_codes
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists password_reset_tokens_no_direct_access on public.password_reset_tokens;
create policy password_reset_tokens_no_direct_access
on public.password_reset_tokens
for all
to anon, authenticated
using (false)
with check (false);

notify pgrst, 'reload schema';

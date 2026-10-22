-- Recover authenticated users' business membership without depending on direct table visibility.
-- Additive only; this does not modify or delete existing business records.
create or replace function public.kasir_get_my_business()
returns table (business_id uuid, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select bm.business_id, bm.role
  from public.kasir_business_members bm
  where bm.user_id = (select auth.uid())
  order by bm.created_at asc
  limit 1;
$$;

revoke all on function public.kasir_get_my_business() from public;
grant execute on function public.kasir_get_my_business() to authenticated;

-- Make onboarding retries safe: if this account already owns a business, return
-- its existing ID instead of surfacing a unique-constraint error.
create or replace function public.kasir_create_business(business_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_business_id uuid;
  new_business_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if business_name is null or length(trim(business_name)) not between 1 and 120 then
    raise exception 'Business name must be between 1 and 120 characters' using errcode = '22023';
  end if;

  select bm.business_id into existing_business_id
  from public.kasir_business_members bm
  where bm.user_id = (select auth.uid())
  order by bm.created_at asc
  limit 1;

  if existing_business_id is not null then
    return existing_business_id;
  end if;

  insert into public.kasir_businesses(name, created_by)
    values (trim(business_name), (select auth.uid()))
    returning id into new_business_id;
  insert into public.kasir_business_members(business_id, user_id, role)
    values (new_business_id, (select auth.uid()), 'owner');
  return new_business_id;
exception
  when unique_violation then
    -- Handle concurrent submissions by resolving the membership created by the winner.
    select bm.business_id into existing_business_id
    from public.kasir_business_members bm
    where bm.user_id = (select auth.uid())
    order by bm.created_at asc
    limit 1;
    if existing_business_id is not null then
      return existing_business_id;
    end if;
    raise;
end;
$$;

revoke all on function public.kasir_create_business(text) from public;
grant execute on function public.kasir_create_business(text) to authenticated;

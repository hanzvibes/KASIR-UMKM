-- Kasir UMKM initial schema.
-- Apply only to a development/staging Supabase project after review. Never run automatically at deploy time.

create extension if not exists pgcrypto;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'cashier')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_id_idx on public.business_members(user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name),
  unique (id, business_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) between 1 and 160),
  sku text,
  unit text not null default 'pcs' check (length(trim(unit)) between 1 and 24),
  price numeric(14,0) not null check (price >= 0),
  cost_price numeric(14,0) check (cost_price is null or cost_price >= 0),
  stock_qty numeric(14,3) check (stock_qty is null or stock_qty >= 0),
  track_stock boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, business_id) references public.categories(id, business_id) on delete set null,
  unique (id, business_id)
);

create unique index products_business_sku_unique on public.products(business_id, sku) where sku is not null;
create index products_business_active_idx on public.products(business_id, is_active);

create table public.business_entitlements (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan_code text not null default 'free' check (plan_code in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members bm
    where bm.business_id = target_business_id and bm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;

create or replace function public.create_business(business_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if business_name is null or length(trim(business_name)) < 1 or length(trim(business_name)) > 120 then
    raise exception 'Business name must be between 1 and 120 characters';
  end if;

  insert into public.businesses(name)
  values (trim(business_name))
  returning id into new_business_id;

  insert into public.business_members(business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');

  insert into public.business_entitlements(business_id, plan_code, status)
  values (new_business_id, 'free', 'active');

  return new_business_id;
end;
$$;

revoke all on function public.create_business(text) from public;
grant execute on function public.create_business(text) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.business_entitlements enable row level security;

create policy "Members can read their businesses"
on public.businesses for select to authenticated
using (public.is_business_member(id));

create policy "Owners can update their businesses"
on public.businesses for update to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
));

create policy "Members can read their membership"
on public.business_members for select to authenticated
using (user_id = (select auth.uid()) or public.is_business_member(business_id));

create policy "Members can read categories"
on public.categories for select to authenticated
using (public.is_business_member(business_id));
create policy "Owners can insert categories"
on public.categories for insert to authenticated
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
));
create policy "Owners can update categories"
on public.categories for update to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
));
create policy "Owners can delete categories"
on public.categories for delete to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
));

create policy "Members can read products"
on public.products for select to authenticated
using (public.is_business_member(business_id));
create policy "Owners can insert products"
on public.products for insert to authenticated
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
));
create policy "Owners can update products"
on public.products for update to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = business_id and bm.user_id = (select auth.uid()) and bm.role = 'owner'
));

create policy "Members can read entitlements"
on public.business_entitlements for select to authenticated
using (public.is_business_member(business_id));

grant select, update on public.businesses to authenticated;
grant select on public.business_members to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update on public.products to authenticated;
grant select on public.business_entitlements to authenticated;

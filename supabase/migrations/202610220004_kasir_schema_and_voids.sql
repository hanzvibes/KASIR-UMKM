-- Additive schema compatibility + sale voiding.
-- The app uses kasir_* names. These CREATE IF NOT EXISTS statements make a fresh
-- database usable even though the original historical migrations also create legacy tables.
-- This migration does not drop, rename, or rewrite FinanceTracker tables/data.

create extension if not exists pgcrypto;

create table if not exists public.kasir_businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.kasir_business_members (
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id),
  unique (user_id)
);
create table if not exists public.kasir_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (business_id, name),
  unique (business_id, id)
);
create table if not exists public.kasir_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) between 1 and 160),
  sku text,
  unit text not null default 'pcs',
  price numeric(14,0) not null check (price >= 0),
  cost_price numeric(14,0) check (cost_price is null or cost_price >= 0),
  stock_qty numeric(14,3) check (stock_qty is null or stock_qty >= 0),
  track_stock boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, category_id) references public.kasir_categories(business_id, id) on delete restrict,
  unique (business_id, id)
);
create unique index if not exists kasir_products_business_sku_unique
  on public.kasir_products(business_id, sku) where sku is not null;
create table if not exists public.kasir_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  total_amount numeric(14,0) not null default 0 check (total_amount >= 0),
  payment_method text not null check (payment_method in ('cash','transfer','other')),
  idempotency_key uuid not null,
  status text not null default 'completed' check (status in ('completed','voided')),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  unique (business_id, id)
);
create table if not exists public.kasir_sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid,
  product_name text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,0) not null check (unit_price >= 0),
  unit_cost numeric(14,0) check (unit_cost is null or unit_cost >= 0),
  line_total numeric(14,0) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  foreign key (business_id, sale_id) references public.kasir_sales(business_id, id) on delete cascade
);
create table if not exists public.kasir_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  category text not null check (length(trim(category)) between 1 and 80),
  description text check (description is null or length(description) <= 240),
  amount numeric(14,0) not null check (amount > 0),
  expense_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  created_at timestamptz not null default now()
);

alter table public.kasir_sales add column if not exists status text not null default 'completed';
alter table public.kasir_sales add column if not exists voided_at timestamptz;
alter table public.kasir_sales add column if not exists voided_by uuid references auth.users(id);
alter table public.kasir_sales add column if not exists void_reason text;
alter table public.kasir_sale_items add column if not exists unit_cost numeric(14,0);

create index if not exists kasir_business_members_user_idx on public.kasir_business_members(user_id);
create index if not exists kasir_products_business_active_idx on public.kasir_products(business_id, is_active);
create index if not exists kasir_sales_business_created_idx on public.kasir_sales(business_id, created_at desc);
create index if not exists kasir_sale_items_sale_idx on public.kasir_sale_items(sale_id, business_id);
create index if not exists kasir_expenses_business_date_idx on public.kasir_expenses(business_id, expense_date desc);

create table if not exists public.kasir_stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.kasir_businesses(id) on delete cascade,
  product_id uuid not null,
  sale_id uuid,
  movement_type text not null check (movement_type in ('sale','sale_void','adjustment')),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists kasir_stock_movements_business_created_idx
  on public.kasir_stock_movements(business_id, created_at desc);
create index if not exists kasir_stock_movements_sale_idx
  on public.kasir_stock_movements(sale_id) where sale_id is not null;

create or replace function public.kasir_is_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.kasir_business_members bm
    where bm.business_id = target_business_id and bm.user_id = (select auth.uid()));
$$;
revoke all on function public.kasir_is_business_member(uuid) from public;
grant execute on function public.kasir_is_business_member(uuid) to authenticated;

create or replace function public.kasir_create_business(business_name text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare new_business_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if business_name is null or length(trim(business_name)) not between 1 and 120 then
    raise exception 'Business name must be between 1 and 120 characters' using errcode = '22023';
  end if;
  if exists (select 1 from public.kasir_business_members where user_id = (select auth.uid())) then
    raise exception 'User already has a business' using errcode = '23505';
  end if;
  insert into public.kasir_businesses(name, created_by) values (trim(business_name), (select auth.uid()))
    returning id into new_business_id;
  insert into public.kasir_business_members(business_id, user_id, role)
    values (new_business_id, (select auth.uid()), 'owner');
  return new_business_id;
end;
$$;
revoke all on function public.kasir_create_business(text) from public;
grant execute on function public.kasir_create_business(text) to authenticated;

create or replace function public.kasir_create_sale(
  p_business_id uuid, p_items jsonb, p_payment_method text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  sale_id uuid;
  sale_total numeric(14,0) := 0;
  item_row record;
  product_row public.kasir_products%rowtype;
  qty numeric(14,3);
  line_total numeric(14,0);
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from public.kasir_business_members bm where bm.business_id=p_business_id and bm.user_id=(select auth.uid())) then
    raise exception 'Business access denied' using errcode = '42501';
  end if;
  if p_payment_method not in ('cash','transfer','other') or p_idempotency_key is null then
    raise exception 'Invalid payment method or idempotency key' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart must contain 1 to 100 items' using errcode = '22023';
  end if;

  insert into public.kasir_sales(business_id, created_by, payment_method, idempotency_key)
    values (p_business_id, (select auth.uid()), p_payment_method, p_idempotency_key)
    on conflict (business_id, idempotency_key) do nothing returning id into sale_id;
  if sale_id is null then
    select s.id into sale_id from public.kasir_sales s
      where s.business_id=p_business_id and s.idempotency_key=p_idempotency_key;
    return jsonb_build_object('id', sale_id, 'duplicate', true);
  end if;

  -- Aggregate duplicates in SQL too; lock products in stable order to avoid races.
  for item_row in
    select (v->>'product_id')::uuid as product_id, sum((v->>'quantity')::numeric)::numeric(14,3) as quantity
    from jsonb_array_elements(p_items) v
    group by (v->>'product_id')::uuid
    order by (v->>'product_id')::uuid
  loop
    qty := item_row.quantity;
    if qty is null or qty <= 0 or qty > 1000000 then raise exception 'Invalid quantity' using errcode='22023'; end if;
    select p.* into product_row from public.kasir_products p
      where p.id=item_row.product_id and p.business_id=p_business_id for update;
    if not found or not product_row.is_active then raise exception 'Product not found or inactive' using errcode='22023'; end if;
    if product_row.track_stock then
      if product_row.stock_qty is null or product_row.stock_qty < qty then raise exception 'Insufficient stock' using errcode='22023'; end if;
      update public.kasir_products set stock_qty=stock_qty-qty, updated_at=now()
        where id=product_row.id and business_id=p_business_id;
      insert into public.kasir_stock_movements(business_id, product_id, sale_id, movement_type, quantity_delta, note, created_by)
        values (p_business_id, product_row.id, sale_id, 'sale', -qty, 'Penjualan', (select auth.uid()));
    end if;
    line_total := round(product_row.price * qty);
    sale_total := sale_total + line_total;
    insert into public.kasir_sale_items(business_id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
      values (p_business_id, sale_id, product_row.id, product_row.name, qty, product_row.price, product_row.cost_price, line_total);
  end loop;
  update public.kasir_sales set total_amount=sale_total where id=sale_id;
  return jsonb_build_object('id', sale_id, 'total_amount', sale_total, 'duplicate', false);
end;
$$;
revoke all on function public.kasir_create_sale(uuid,jsonb,text,uuid) from public;
grant execute on function public.kasir_create_sale(uuid,jsonb,text,uuid) to authenticated;

create or replace function public.kasir_void_sale(p_sale_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare sale_row public.kasir_sales%rowtype; item_row record;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 240 then raise exception 'Invalid reason' using errcode='22023'; end if;
  select s.* into sale_row from public.kasir_sales s where s.id=p_sale_id for update;
  if not found then raise exception 'Sale not found' using errcode='P0002'; end if;
  if not exists (select 1 from public.kasir_business_members bm where bm.business_id=sale_row.business_id and bm.user_id=(select auth.uid()) and bm.role='owner') then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if sale_row.status='voided' then return jsonb_build_object('id',sale_row.id,'status','voided','duplicate',true); end if;

  for item_row in
    select si.product_id, sum(si.quantity)::numeric(14,3) quantity
    from public.kasir_sale_items si where si.sale_id=sale_row.id and si.business_id=sale_row.business_id
      and si.product_id is not null group by si.product_id order by si.product_id
  loop
    update public.kasir_products p set stock_qty=p.stock_qty+item_row.quantity, updated_at=now()
      where p.id=item_row.product_id and p.business_id=sale_row.business_id and p.track_stock=true;
    if found then
      insert into public.kasir_stock_movements(business_id,product_id,sale_id,movement_type,quantity_delta,note,created_by)
        values (sale_row.business_id,item_row.product_id,sale_row.id,'sale_void',item_row.quantity,trim(p_reason),(select auth.uid()));
    end if;
  end loop;
  update public.kasir_sales set status='voided',voided_at=now(),voided_by=(select auth.uid()),void_reason=trim(p_reason)
    where id=sale_row.id;
  return jsonb_build_object('id',sale_row.id,'status','voided','duplicate',false);
end;
$$;
revoke all on function public.kasir_void_sale(uuid,text) from public;
grant execute on function public.kasir_void_sale(uuid,text) to authenticated;

alter table public.kasir_businesses enable row level security;
alter table public.kasir_business_members enable row level security;
alter table public.kasir_categories enable row level security;
alter table public.kasir_products enable row level security;
alter table public.kasir_sales enable row level security;
alter table public.kasir_sale_items enable row level security;
alter table public.kasir_expenses enable row level security;
alter table public.kasir_stock_movements enable row level security;

drop policy if exists "kasir members read businesses" on public.kasir_businesses;
create policy "kasir members read businesses" on public.kasir_businesses for select to authenticated using (public.kasir_is_business_member(id));
drop policy if exists "kasir members read memberships" on public.kasir_business_members;
create policy "kasir members read memberships" on public.kasir_business_members for select to authenticated using (user_id=(select auth.uid()) or public.kasir_is_business_member(business_id));
drop policy if exists "kasir members read categories" on public.kasir_categories;
create policy "kasir members read categories" on public.kasir_categories for select to authenticated using (public.kasir_is_business_member(business_id));
drop policy if exists "kasir owners manage categories" on public.kasir_categories;
create policy "kasir owners manage categories" on public.kasir_categories for all to authenticated
using (exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_categories.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'))
with check (exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_categories.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'));
drop policy if exists "kasir members read products" on public.kasir_products;
create policy "kasir members read products" on public.kasir_products for select to authenticated using (public.kasir_is_business_member(business_id));
drop policy if exists "kasir owners manage products" on public.kasir_products;
create policy "kasir owners manage products" on public.kasir_products for all to authenticated
using (exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_products.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'))
with check (exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_products.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'));
drop policy if exists "kasir members read sales" on public.kasir_sales;
create policy "kasir members read sales" on public.kasir_sales for select to authenticated using (public.kasir_is_business_member(business_id));
drop policy if exists "kasir members read sale items" on public.kasir_sale_items;
create policy "kasir members read sale items" on public.kasir_sale_items for select to authenticated using (public.kasir_is_business_member(business_id));
drop policy if exists "kasir members read expenses" on public.kasir_expenses;
create policy "kasir members read expenses" on public.kasir_expenses for select to authenticated using (public.kasir_is_business_member(business_id));
drop policy if exists "kasir owners manage expenses" on public.kasir_expenses;
create policy "kasir owners manage expenses" on public.kasir_expenses for all to authenticated
using (exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_expenses.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'))
with check (exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_expenses.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'));
drop policy if exists "kasir members read stock movements" on public.kasir_stock_movements;
create policy "kasir members read stock movements" on public.kasir_stock_movements for select to authenticated using (public.kasir_is_business_member(business_id));

grant select on public.kasir_businesses, public.kasir_business_members, public.kasir_categories,
  public.kasir_products, public.kasir_sales, public.kasir_sale_items, public.kasir_expenses,
  public.kasir_stock_movements to authenticated;
grant insert, update, delete on public.kasir_categories, public.kasir_products, public.kasir_expenses to authenticated;

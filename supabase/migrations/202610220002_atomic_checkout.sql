-- Atomic checkout and immutable sales snapshots.
-- Apply only to a development/staging Supabase project after review.

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  receipt_no bigint generated always as identity,
  idempotency_key uuid not null,
  payment_method text not null check (payment_method in ('cash', 'transfer', 'other')),
  subtotal numeric(14,0) not null default 0 check (subtotal >= 0),
  total numeric(14,0) not null default 0 check (total >= 0),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  unique (business_id, receipt_no),
  unique (id, business_id)
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  business_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  sku text,
  unit text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_price numeric(14,0) not null check (unit_price >= 0),
  unit_cost numeric(14,0) check (unit_cost is null or unit_cost >= 0),
  line_total numeric(14,0) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  foreign key (sale_id, business_id) references public.sales(id, business_id) on delete cascade,
  foreign key (product_id, business_id) references public.products(id, business_id) on delete restrict
);

create index sales_business_created_idx on public.sales(business_id, created_at desc);
create index sale_items_sale_idx on public.sale_items(sale_id, business_id);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

create policy "Members can read sales"
on public.sales for select to authenticated
using (public.is_business_member(business_id));

create policy "Members can read sale items"
on public.sale_items for select to authenticated
using (public.is_business_member(business_id));

grant select on public.sales, public.sale_items to authenticated;

create or replace function public.create_sale(
  p_business_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_sale_id uuid;
  new_receipt_no bigint;
  item jsonb;
  product_row public.products%rowtype;
  product_id uuid;
  quantity_value numeric(14,3);
  line_total_value numeric(14,0);
  subtotal_value numeric(14,0) := 0;
  inserted_item_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.business_members bm
    where bm.business_id = p_business_id and bm.user_id = auth.uid()
  ) then
    raise exception 'Business access denied' using errcode = '42501';
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'transfer', 'other') then
    raise exception 'Invalid payment method' using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;

  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Cart must be a JSON array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart must contain between 1 and 100 items' using errcode = '22023';
  end if;

  -- A retry with the same key returns the original sale and never deducts stock twice.
  insert into public.sales(business_id, idempotency_key, payment_method, created_by)
  values (p_business_id, p_idempotency_key, p_payment_method, auth.uid())
  on conflict (business_id, idempotency_key) do nothing
  returning id, receipt_no into new_sale_id, new_receipt_no;

  if new_sale_id is null then
    select s.id, s.receipt_no into new_sale_id, new_receipt_no
    from public.sales s
    where s.business_id = p_business_id and s.idempotency_key = p_idempotency_key;

    return jsonb_build_object('id', new_sale_id, 'receipt_no', new_receipt_no, 'duplicate', true);
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(item->>'product_id', '') = '' then
      raise exception 'Product ID is required' using errcode = '22023';
    end if;

    product_id := (item->>'product_id')::uuid;
    quantity_value := (item->>'quantity')::numeric;

    if quantity_value is null or quantity_value <= 0 or quantity_value > 1000000 then
      raise exception 'Quantity must be greater than zero' using errcode = '22023';
    end if;

    select p.* into product_row
    from public.products p
    where p.id = product_id and p.business_id = p_business_id
    for update;

    if not found or not product_row.is_active then
      raise exception 'Product not found or inactive: %', product_id using errcode = '22023';
    end if;

    if product_row.track_stock then
      if product_row.stock_qty is null or product_row.stock_qty < quantity_value then
        raise exception 'Insufficient stock for product: %', product_row.name using errcode = '22023';
      end if;

      update public.products
      set stock_qty = stock_qty - quantity_value, updated_at = now()
      where id = product_id and business_id = p_business_id;
    end if;

    line_total_value := round(product_row.price * quantity_value);
    subtotal_value := subtotal_value + line_total_value;
    inserted_item_count := inserted_item_count + 1;

    insert into public.sale_items(
      sale_id, business_id, product_id, product_name, sku, unit,
      quantity, unit_price, unit_cost, line_total
    ) values (
      new_sale_id, p_business_id, product_row.id, product_row.name, product_row.sku, product_row.unit,
      quantity_value, product_row.price, product_row.cost_price, line_total_value
    );
  end loop;

  update public.sales
  set subtotal = subtotal_value, total = subtotal_value
  where id = new_sale_id and business_id = p_business_id;

  return jsonb_build_object(
    'id', new_sale_id,
    'receipt_no', new_receipt_no,
    'subtotal', subtotal_value,
    'total', subtotal_value,
    'duplicate', false
  );
end;
$$;

revoke all on function public.create_sale(uuid, jsonb, text, uuid) from public;
grant execute on function public.create_sale(uuid, jsonb, text, uuid) to authenticated;

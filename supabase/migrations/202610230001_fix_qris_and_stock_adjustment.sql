-- QRIS checkout fix + owner stock replenishment.
--
-- The original kasir_sales.payment_method constraint only allowed
-- ('cash','transfer','other'), while kasir_create_sale writes 'qris'.
-- Every QRIS sale therefore failed at the initial INSERT. Replace the
-- constraint while keeping 'other' readable for legacy rows.
do $$
declare constraint_row record;
begin
  for constraint_row in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.kasir_sales'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%payment_method%'
  loop
    execute format('alter table public.kasir_sales drop constraint %I', constraint_row.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.kasir_sales'::regclass
      and conname = 'kasir_sales_payment_method_allowed'
  ) then
    alter table public.kasir_sales
      add constraint kasir_sales_payment_method_allowed
      check (payment_method in ('cash','qris','transfer','other'));
  end if;
end $$;

-- Owners can add received stock without editing every product field.
-- The adjustment is recorded in kasir_stock_movements so the ledger stays
-- consistent with stock_qty, and only active tracked products can be changed.
create or replace function public.kasir_adjust_stock(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  product_row public.kasir_products%rowtype;
  new_stock numeric(14,3);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_product_id is null then
    raise exception 'Product is required' using errcode='22023';
  end if;
  if p_quantity_delta is null or p_quantity_delta <= 0 or p_quantity_delta > 1000000
    or round(p_quantity_delta, 3) <> p_quantity_delta then
    raise exception 'Invalid stock adjustment' using errcode='22023';
  end if;
  if p_note is not null and length(trim(p_note)) > 240 then
    raise exception 'Stock note is too long' using errcode='22023';
  end if;

  select * into product_row
    from public.kasir_products
    where id = p_product_id and deleted_at is null
    for update;
  if not found then
    raise exception 'Product not found' using errcode='P0002';
  end if;
  if not exists (
    select 1 from public.kasir_business_members bm
    where bm.business_id = product_row.business_id
      and bm.user_id = (select auth.uid())
      and bm.role = 'owner'
      and bm.active
  ) then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if not product_row.track_stock then
    raise exception 'Stock tracking is disabled for this product' using errcode='22023';
  end if;

  update public.kasir_products
    set stock_qty = coalesce(stock_qty, 0) + p_quantity_delta,
        updated_at = now()
    where id = product_row.id and business_id = product_row.business_id
    returning stock_qty into new_stock;

  insert into public.kasir_stock_movements(
    business_id, product_id, movement_type, quantity_delta, note, created_by
  ) values (
    product_row.business_id,
    product_row.id,
    'adjustment',
    p_quantity_delta,
    coalesce(nullif(trim(p_note), ''), 'Tambah stok'),
    (select auth.uid())
  );

  return jsonb_build_object('product_id', product_row.id, 'stock_qty', new_stock);
end $$;

revoke all on function public.kasir_adjust_stock(uuid, numeric, text) from public;
grant execute on function public.kasir_adjust_stock(uuid, numeric, text) to authenticated;

create or replace function public.kasir_create_sale(
  p_business_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_idempotency_key uuid,
  p_cash_received numeric,
  p_discount bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  sale_id uuid;
  sale_total numeric(14,0):=0;
  subtotal_value numeric(14,0):=0;
  item_row record;
  product_row public.kasir_products%rowtype;
  quantity numeric(14,3);
  line_total numeric(14,0);
  current_shift uuid;
  current_outlet uuid;
  invoice text;
  sequence_value integer;
  local_date date;
  group_count integer;
  selected_group_name text;
  selected_option_name text;
  selected_delta bigint:=0;
  effective_price numeric(14,0);
  snapshot_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not exists(select 1 from public.kasir_business_members where business_id=p_business_id and user_id=(select auth.uid()) and active) then
    raise exception 'Business access denied' using errcode='42501';
  end if;
  select id,outlet_id into current_shift,current_outlet
    from public.kasir_shifts
    where business_id=p_business_id and cashier_id=(select auth.uid()) and status='open'
    for update;
  if current_shift is null then raise exception 'Open shift required' using errcode='22023'; end if;
  if p_payment_method not in('cash','qris','transfer') or p_idempotency_key is null then
    raise exception 'Invalid payment method or idempotency key' using errcode='22023';
  end if;
  if p_discount is null or p_discount<0 then raise exception 'Invalid discount' using errcode='22023'; end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then
    raise exception 'Invalid cart' using errcode='22023';
  end if;

  insert into public.kasir_sales(business_id,created_by,payment_method,idempotency_key,shift_id,outlet_id)
    values(p_business_id,(select auth.uid()),p_payment_method,p_idempotency_key,current_shift,current_outlet)
    on conflict(business_id,idempotency_key) do nothing returning id into sale_id;
  if sale_id is null then
    select id into sale_id from public.kasir_sales where business_id=p_business_id and idempotency_key=p_idempotency_key;
    return jsonb_build_object('id',sale_id,'duplicate',true);
  end if;

  for item_row in
    select (v->>'product_id')::uuid as product_id,
           nullif(v->>'variant_option_id','')::uuid as variant_option_id,
           sum((v->>'quantity')::numeric)::numeric(14,3) as quantity
    from jsonb_array_elements(p_items) v
    group by 1,2 order by 1,2
  loop
    quantity:=item_row.quantity;
    if quantity is null or quantity<=0 or quantity>1000000 then raise exception 'Invalid quantity' using errcode='22023'; end if;
    select * into product_row from public.kasir_products
      where id=item_row.product_id and business_id=p_business_id and deleted_at is null
      for update;
    if not found or not product_row.is_active then raise exception 'Product not found or inactive' using errcode='22023'; end if;

    select count(*) into group_count from public.kasir_product_variant_groups
      where business_id=p_business_id and product_id=product_row.id;
    if group_count>1 then raise exception 'Multiple variant groups are not supported' using errcode='22023'; end if;
    selected_delta:=0;
    selected_group_name:=null;
    selected_option_name:=null;
    if group_count=1 then
      select g.name into selected_group_name
        from public.kasir_product_variant_groups g
        where g.business_id=p_business_id and g.product_id=product_row.id;
      if item_row.variant_option_id is null then
        if exists(select 1 from public.kasir_product_variant_groups g where g.business_id=p_business_id and g.product_id=product_row.id and g.required) then
          raise exception 'Variant selection required' using errcode='22023';
        end if;
      else
        select o.price_delta,o.name into selected_delta,selected_option_name
          from public.kasir_product_variant_options o
          join public.kasir_product_variant_groups g on g.id=o.group_id and g.business_id=o.business_id
          where o.id=item_row.variant_option_id and o.business_id=p_business_id and g.product_id=product_row.id;
        if not found then raise exception 'Invalid product variant' using errcode='22023'; end if;
      end if;
    elsif item_row.variant_option_id is not null then
      raise exception 'Invalid product variant' using errcode='22023';
    end if;

    effective_price:=product_row.price::numeric+selected_delta::numeric;
    if effective_price<0 or effective_price>99999999999999 then raise exception 'Variant price is out of range' using errcode='22023'; end if;
    if product_row.track_stock then
      if product_row.stock_qty is null or product_row.stock_qty<quantity then raise exception 'Insufficient stock' using errcode='22023'; end if;
      update public.kasir_products set stock_qty=stock_qty-quantity,updated_at=now() where id=product_row.id and business_id=p_business_id;
      insert into public.kasir_stock_movements(business_id,product_id,sale_id,movement_type,quantity_delta,note,created_by)
        values(p_business_id,product_row.id,sale_id,'sale',-quantity,'Penjualan',(select auth.uid()));
    end if;

    line_total:=round(effective_price*quantity);
    subtotal_value:=subtotal_value+line_total;
    snapshot_name:=product_row.name;
    if selected_option_name is not null then snapshot_name:=product_row.name||' ('||selected_group_name||': '||selected_option_name||')'; end if;
    insert into public.kasir_sale_items(business_id,sale_id,product_id,product_name,unit,quantity,unit_price,unit_cost,line_total,outlet_id)
      values(p_business_id,sale_id,product_row.id,snapshot_name,product_row.unit,quantity,effective_price,product_row.cost_price,line_total,current_outlet);
  end loop;

  if p_discount>subtotal_value then raise exception 'Discount cannot exceed subtotal' using errcode='22023'; end if;
  sale_total:=subtotal_value-p_discount;
  if p_payment_method='cash' and (p_cash_received is null or p_cash_received<sale_total or p_cash_received<>trunc(p_cash_received)) then
    raise exception 'Cash received must cover total' using errcode='22023';
  end if;
  local_date:=(now() at time zone 'Asia/Jakarta')::date;
  insert into public.kasir_invoice_sequences(business_id,sale_date,last_value) values(p_business_id,local_date,1)
    on conflict(business_id,sale_date) do update set last_value=public.kasir_invoice_sequences.last_value+1 returning last_value into sequence_value;
  invoice:='INV-'||to_char(local_date,'YYYYMMDD')||'-'||lpad(sequence_value::text,4,'0');
  update public.kasir_sales set total_amount=sale_total,discount=p_discount,
    paid=case when p_payment_method='cash' then p_cash_received else sale_total end,
    cash_received=case when p_payment_method='cash' then p_cash_received else null end,
    change_due=case when p_payment_method='cash' then p_cash_received-sale_total else 0 end,
    invoice_no=invoice where id=sale_id;
  return jsonb_build_object('id',sale_id,'subtotal',subtotal_value,'discount',p_discount,'total_amount',sale_total,'invoice_no',invoice,'duplicate',false);
end;
$$;

revoke all on function public.kasir_create_sale(uuid,jsonb,text,uuid,numeric,bigint) from public;
revoke execute on function public.kasir_create_sale(uuid,jsonb,text,uuid,numeric,bigint) from anon;
grant execute on function public.kasir_create_sale(uuid,jsonb,text,uuid,numeric,bigint) to authenticated;

create or replace function public.kasir_save_product_variants(
  p_product_id uuid,
  p_group_name text,
  p_required boolean,
  p_options jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  business uuid;
  base_price bigint;
  group_id uuid;
  option_row jsonb;
  option_name text;
  option_delta bigint;
  option_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select bm.business_id into business from public.kasir_business_members bm
    where bm.user_id=(select auth.uid()) and bm.active and bm.role='owner' order by bm.created_at asc limit 1;
  if business is null then raise exception 'Owner access required' using errcode='42501'; end if;
  select p.price into base_price from public.kasir_products p
    where p.id=p_product_id and p.business_id=business and p.deleted_at is null;
  if not found then raise exception 'Product not found' using errcode='P0002'; end if;
  if p_options is null or jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options)>12 then
    raise exception 'Invalid product options' using errcode='22023';
  end if;
  option_count:=jsonb_array_length(p_options);
  if option_count=0 then
    delete from public.kasir_product_variant_groups where business_id=business and product_id=p_product_id;
    insert into public.kasir_audit_logs(business_id,actor_id,action,entity,entity_id)
      values(business,(select auth.uid()),'variants_removed','product',p_product_id);
    return;
  end if;
  if p_group_name is null or length(trim(p_group_name)) not between 1 and 80 then
    raise exception 'Invalid variant group name' using errcode='22023';
  end if;
  for option_row in select value from jsonb_array_elements(p_options)
  loop
    option_name:=nullif(trim(option_row->>'name'),'');
    if option_name is null or length(option_name)>80 or coalesce(option_row->>'price_delta','') !~ '^-?[0-9]{1,10}$' then
      raise exception 'Invalid variant option' using errcode='22023';
    end if;
    option_delta:=(option_row->>'price_delta')::bigint;
    if option_delta < -1000000000 or option_delta > 1000000000 or base_price::numeric+option_delta::numeric<0 then
      raise exception 'Variant price adjustment is out of range' using errcode='22023';
    end if;
  end loop;
  if (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p_options))<>option_count then
    raise exception 'Variant option names must be unique' using errcode='22023';
  end if;
  delete from public.kasir_product_variant_groups where business_id=business and product_id=p_product_id;
  insert into public.kasir_product_variant_groups(business_id,product_id,name,required)
    values(business,p_product_id,trim(p_group_name),coalesce(p_required,false)) returning id into group_id;
  for option_row in select value from jsonb_array_elements(p_options)
  loop
    insert into public.kasir_product_variant_options(business_id,group_id,name,price_delta)
      values(business,group_id,trim(option_row->>'name'),(option_row->>'price_delta')::bigint);
  end loop;
  insert into public.kasir_audit_logs(business_id,actor_id,action,entity,entity_id,details)
    values(business,(select auth.uid()),'variants_saved','product',p_product_id,jsonb_build_object('group_name',trim(p_group_name),'option_count',option_count));
end;
$$;
revoke all on function public.kasir_save_product_variants(uuid,text,boolean,jsonb) from public;
revoke execute on function public.kasir_save_product_variants(uuid,text,boolean,jsonb) from anon;
grant execute on function public.kasir_save_product_variants(uuid,text,boolean,jsonb) to authenticated;

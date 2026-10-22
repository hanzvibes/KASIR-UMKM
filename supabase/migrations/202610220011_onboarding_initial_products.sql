create or replace function public.kasir_create_business_wizard(
  business_name text,
  business_type text,
  p_load_sample boolean,
  p_initial_products jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  bid uuid;
  item jsonb;
  product_name text;
  product_sku text;
  product_price numeric(14,0);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if business_name is null or length(trim(business_name)) not between 1 and 120 then
    raise exception 'Invalid business name' using errcode = '22023';
  end if;
  if business_type not in ('makanan','minuman','retail','jasa','lainnya') then
    raise exception 'Invalid business type' using errcode = '22023';
  end if;
  if p_initial_products is null or jsonb_typeof(p_initial_products) is distinct from 'array'
     or jsonb_array_length(p_initial_products) > 10 then
    raise exception 'Invalid initial products' using errcode = '22023';
  end if;
  if coalesce(p_load_sample, false) and jsonb_array_length(p_initial_products) > 0 then
    raise exception 'Choose sample products or own products' using errcode = '22023';
  end if;

  -- A retry after a successful onboarding must not rename the business or add products twice.
  select bm.business_id into bid
  from public.kasir_business_members bm
  where bm.user_id = (select auth.uid())
  order by bm.created_at asc
  limit 1;
  if bid is not null then
    return bid;
  end if;

  bid := public.kasir_create_business(trim(business_name));
  update public.kasir_businesses
  set business_type = kasir_create_business_wizard.business_type
  where id = bid and created_by = (select auth.uid());

  if coalesce(p_load_sample, false) then
    perform public.kasir_load_sample_data(bid);
  else
    for item in select value from jsonb_array_elements(p_initial_products)
    loop
      product_name := nullif(trim(item->>'name'), '');
      product_sku := nullif(trim(item->>'sku'), '');
      if product_name is null or length(product_name) > 160 then
        raise exception 'Invalid initial product name' using errcode = '22023';
      end if;
      if product_sku is not null and length(product_sku) > 80 then
        raise exception 'Invalid initial product SKU' using errcode = '22023';
      end if;
      if coalesce(item->>'price', '') !~ '^[0-9]{1,14}$' then
        raise exception 'Invalid initial product price' using errcode = '22023';
      end if;
      product_price := (item->>'price')::numeric(14,0);
      insert into public.kasir_products(business_id, name, sku, price, unit)
      values (bid, product_name, product_sku, product_price, 'pcs');
    end loop;
  end if;
  return bid;
end;
$$;

revoke all on function public.kasir_create_business_wizard(text,text,boolean,jsonb) from public;
revoke execute on function public.kasir_create_business_wizard(text,text,boolean,jsonb) from anon;
grant execute on function public.kasir_create_business_wizard(text,text,boolean,jsonb) to authenticated;

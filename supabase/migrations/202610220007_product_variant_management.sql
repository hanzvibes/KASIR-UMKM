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
  group_id uuid;
  option_row jsonb;
  option_name text;
  option_delta bigint;
  option_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select bm.business_id into business
    from public.kasir_business_members bm
    where bm.user_id=(select auth.uid()) and bm.active and bm.role='owner'
    order by bm.created_at asc limit 1;
  if business is null then raise exception 'Owner access required' using errcode='42501'; end if;
  if not exists(select 1 from public.kasir_products p where p.id=p_product_id and p.business_id=business and p.deleted_at is null) then
    raise exception 'Product not found' using errcode='P0002';
  end if;
  if p_options is null or jsonb_typeof(p_options) is distinct from 'array' or jsonb_array_length(p_options)>12 then
    raise exception 'Invalid product options' using errcode='22023';
  end if;

  option_count := jsonb_array_length(p_options);
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
    option_name := nullif(trim(option_row->>'name'),'');
    if option_name is null or length(option_name)>80 or coalesce(option_row->>'price_delta','') !~ '^-?[0-9]{1,10}$' then
      raise exception 'Invalid variant option' using errcode='22023';
    end if;
    option_delta := (option_row->>'price_delta')::bigint;
    if option_delta < -1000000000 or option_delta > 1000000000 then
      raise exception 'Variant price adjustment is out of range' using errcode='22023';
    end if;
  end loop;

  if (select count(distinct lower(trim(value->>'name'))) from jsonb_array_elements(p_options)) <> option_count then
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
grant execute on function public.kasir_save_product_variants(uuid,text,boolean,jsonb) to authenticated;

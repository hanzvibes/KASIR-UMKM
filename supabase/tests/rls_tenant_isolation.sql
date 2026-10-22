begin;

select plan(46);

-- Fixtures are rolled back so this test can run repeatedly against a local database.
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'tenant-a@example.test', 'test-only', now(), now(), now()),
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'tenant-b@example.test', 'test-only', now(), now(), now());

insert into public.businesses (id, name)
values
  ('a1000000-0000-4000-8000-000000000001', 'Tenant A'),
  ('b1000000-0000-4000-8000-000000000002', 'Tenant B');

insert into public.business_members (business_id, user_id, role)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'owner');

insert into public.categories (id, business_id, name)
values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Tenant A category'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Tenant B category');

insert into public.products (id, business_id, category_id, name, sku, unit, price, track_stock, stock_qty)
values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Tenant A product', 'TENANT-A', 'pcs', 1000, true, 10),
  ('b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Tenant B product', 'TENANT-B', 'pcs', 2000, true, 10);

insert into public.business_entitlements (business_id)
values ('a1000000-0000-4000-8000-000000000001'), ('b1000000-0000-4000-8000-000000000002');

insert into public.sales (id, business_id, idempotency_key, payment_method, created_by)
values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'cash', 'a0000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b5000000-0000-4000-8000-000000000002', 'cash', 'b0000000-0000-4000-8000-000000000002');

insert into public.sale_items (sale_id, business_id, product_id, product_name, sku, unit, quantity, unit_price, line_total)
values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Tenant A product', 'TENANT-A', 'pcs', 1, 1000, 1000),
  ('b4000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'Tenant B product', 'TENANT-B', 'pcs', 1, 2000, 2000);

insert into public.expenses (business_id, category, amount, created_by)
values
  ('a1000000-0000-4000-8000-000000000001', 'Operasional A', 1000, 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'Operasional B', 2000, 'b0000000-0000-4000-8000-000000000002');

insert into public.kasir_businesses (id, name, created_by)
values
  ('a1000000-0000-4000-8000-000000000001', 'Tenant A', 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'Tenant B', 'b0000000-0000-4000-8000-000000000002');

insert into public.kasir_business_members (business_id, user_id, role)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'owner');

insert into public.kasir_categories (id, business_id, name)
values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Tenant A category'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'Tenant B category');

insert into public.kasir_products (id, business_id, category_id, name, price, track_stock, stock_qty)
values
  ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Tenant A product', 1000, true, 10),
  ('b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Tenant B product', 2000, true, 10),
  ('aa300000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'Variant drink', 4000, true, 5);

insert into public.kasir_sales (id, business_id, created_by, total_amount, payment_method, idempotency_key)
values
  ('a4000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 1000, 'cash', 'a5000000-0000-4000-8000-000000000001'),
  ('b4000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 2000, 'cash', 'b5000000-0000-4000-8000-000000000002');

insert into public.kasir_sale_items (business_id, sale_id, product_id, product_name, quantity, unit_price, line_total)
values
  ('a1000000-0000-4000-8000-000000000001', 'a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'Tenant A product', 1, 1000, 1000),
  ('b1000000-0000-4000-8000-000000000002', 'b4000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'Tenant B product', 1, 2000, 2000);

insert into public.kasir_expenses (business_id, created_by, category, amount)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Operasional A', 1000),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'Operasional B', 2000);

insert into public.kasir_stock_movements (business_id, product_id, movement_type, quantity_delta, created_by)
values
  ('a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'adjustment', 1, 'a0000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002', 'b3000000-0000-4000-8000-000000000002', 'adjustment', 1, 'b0000000-0000-4000-8000-000000000002');

insert into public.kasir_outlets(id,business_id,name) values
 ('a6000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','A'),
 ('b6000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','B');
insert into public.kasir_shifts(id,business_id,outlet_id,cashier_id,opening_cash,status,closed_at) values
 ('a7000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001',0,'closed',now()),
 ('b7000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002',0,'closed',now());
insert into public.kasir_shift_cash_movements(business_id,shift_id,movement_type,amount,reason,created_by) values
 ('a1000000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','cash_in',10,'A','a0000000-0000-4000-8000-000000000001'),
 ('b1000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000002','cash_in',10,'B','b0000000-0000-4000-8000-000000000002');
insert into public.kasir_product_variant_groups(id,business_id,product_id,name) values
 ('a8000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','Ukuran'),
 ('b8000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000002','Ukuran');
insert into public.kasir_product_variant_options(id,business_id,group_id,name) values
 ('a9000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a8000000-0000-4000-8000-000000000001','Besar'),
 ('b9000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','b8000000-0000-4000-8000-000000000002','Besar');
insert into public.kasir_product_variant_groups(id,business_id,product_id,name,required) values
 ('aa800000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','aa300000-0000-4000-8000-000000000001','Ukuran',true);
insert into public.kasir_product_variant_options(id,business_id,group_id,name,price_delta) values
 ('aa900000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','aa800000-0000-4000-8000-000000000001','Reguler',0),
 ('aa900000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','aa800000-0000-4000-8000-000000000001','Besar',1500);
insert into public.kasir_audit_logs(business_id,action,entity,details) values
 ('a1000000-0000-4000-8000-000000000001','test','product','{}'),
 ('b1000000-0000-4000-8000-000000000002','test','product','{}');
insert into public.kasir_invoice_sequences(business_id,sale_date,last_value) values
 ('a1000000-0000-4000-8000-000000000001',(now() at time zone 'Asia/Jakarta')::date,1),
 ('b1000000-0000-4000-8000-000000000002',(now() at time zone 'Asia/Jakarta')::date,1);

select ok(
  (select bool_and(c.relrowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any(array[
       'kasir_businesses', 'kasir_business_members', 'kasir_categories', 'kasir_products',
       'kasir_sales', 'kasir_sale_items', 'kasir_expenses', 'kasir_stock_movements',
       'kasir_outlets', 'kasir_shifts', 'kasir_shift_cash_movements', 'kasir_product_variant_groups',
       'kasir_product_variant_options', 'kasir_audit_logs', 'kasir_invoice_sequences'
     ]))
  and
  (select bool_and(c.relrowsecurity)
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = any(array[
       'businesses', 'business_members', 'categories', 'products', 'business_entitlements',
       'sales', 'sale_items', 'expenses'
     ])),
  'RLS is enabled on every current POS business table'
);

select set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.businesses where id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B businesses');
select is((select count(*) from public.business_members where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B memberships');
select is((select count(*) from public.categories where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B categories');
select is((select count(*) from public.products where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B products');
select is((select count(*) from public.business_entitlements where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B plan data');
select is((select count(*) from public.sales where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B sales');
select is((select count(*) from public.sale_items where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B sale items');
select is((select count(*) from public.expenses where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B expenses');

select is((select count(*) from public.kasir_businesses where id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B');
select is((select count(*) from public.kasir_business_members where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B memberships');
select is((select count(*) from public.kasir_categories where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B categories');
select is((select count(*) from public.kasir_products where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B products');
select is((select count(*) from public.kasir_sales where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B transactions');
select is((select count(*) from public.kasir_sale_items where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B transaction items');
select is((select count(*) from public.kasir_expenses where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B expenses');
select is((select count(*) from public.kasir_stock_movements where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B stock movements');
select is((select count(*) from public.kasir_outlets where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B outlets');
select is((select count(*) from public.kasir_shifts where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B shifts');
select is((select count(*) from public.kasir_shift_cash_movements where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B cash movements');
select is((select count(*) from public.kasir_product_variant_groups where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B variant groups');
select is((select count(*) from public.kasir_product_variant_options where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B variant options');
select is((select count(*) from public.kasir_audit_logs where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B audit logs');
select is((select count(*) from public.kasir_invoice_sequences where business_id = 'b1000000-0000-4000-8000-000000000002'), 0::bigint, 'business A cannot read business B invoice sequences');

select is((select count(*) from public.products where business_id = 'a1000000-0000-4000-8000-000000000001'), 1::bigint, 'business A can read its own products');
select is((select count(*) from public.sales where business_id = 'a1000000-0000-4000-8000-000000000001'), 1::bigint, 'business A can read its own sales');
select is((select count(*) from public.kasir_products where business_id = 'a1000000-0000-4000-8000-000000000001'), 1::bigint, 'business A can read its own products');
select is((select count(*) from public.kasir_sales where business_id = 'a1000000-0000-4000-8000-000000000001'), 1::bigint, 'business A can read its own transactions');
select is((with changed as (
  update public.products set price = 9999 where business_id = 'b1000000-0000-4000-8000-000000000002' returning 1
) select count(*) from changed), 0::bigint, 'business A cannot update business B products');
select is((with changed as (
  update public.kasir_products set price = 9999 where business_id = 'b1000000-0000-4000-8000-000000000002' returning 1
) select count(*) from changed), 0::bigint, 'business A cannot update business B products');
select is((with removed as (
  delete from public.kasir_expenses where business_id = 'b1000000-0000-4000-8000-000000000002' returning 1
) select count(*) from removed), 0::bigint, 'business A cannot delete business B expenses');
select is((with removed as (
  delete from public.expenses where business_id = 'b1000000-0000-4000-8000-000000000002' returning 1
) select count(*) from removed), 0::bigint, 'business A cannot delete business B legacy expenses');
select throws_ok(
  $$insert into public.categories (business_id, name) values ('b1000000-0000-4000-8000-000000000002', 'Unauthorized')$$,
  '42501', null,
  'business A cannot insert business B categories'
);
select throws_ok(
  $$insert into public.kasir_categories (business_id, name) values ('b1000000-0000-4000-8000-000000000002', 'Unauthorized')$$,
  '42501', null,
  'business A cannot insert data into business B'
);

select throws_ok(
  $$select public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"a3000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,'cash','aa000000-0000-4000-8000-000000000001',1000,0)$$,
  '22023', null, 'checkout is rejected when no shift is open'
);
do $$
declare shift_id uuid;
begin
 shift_id:=public.kasir_open_shift(1000);
end $$;
select throws_ok(
 $$select public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"a3000000-0000-4000-8000-000000000001","quantity":11}]'::jsonb,'cash','aa000000-0000-4000-8000-000000000003',11000,0)$$,
 '22023', null, 'checkout refuses quantities above available stock'
);
select is((select stock_qty from public.kasir_products where id='a3000000-0000-4000-8000-000000000001'),10::numeric,'failed checkout does not make stock negative or decrement it');
do $$
declare shift_id uuid;
begin
 select id into shift_id from public.kasir_shifts where cashier_id='a0000000-0000-4000-8000-000000000001' and status='open';
 perform public.kasir_add_cash_movement(shift_id,'cash_in',500,'Uang tambahan');
 perform public.kasir_add_cash_movement(shift_id,'cash_out',200,'Belanja kecil');
 perform public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"a3000000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,'cash','aa000000-0000-4000-8000-000000000002',1000,0);
end $$;
select is((public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"a3000000-0000-4000-8000-000000000001","quantity":9}]'::jsonb,'cash','aa000000-0000-4000-8000-000000000002',9000,0)->>'duplicate')::boolean,true,'checkout retry with same key returns original sale');
select is((select total_amount from public.kasir_sales where idempotency_key='aa000000-0000-4000-8000-000000000002'),1000::bigint,'checkout computes total from database product price');
select throws_ok(
 $$select public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"aa300000-0000-4000-8000-000000000001","quantity":1}]'::jsonb,'qris','aa000000-0000-4000-8000-000000000004',null,0)$$,
 '22023', null, 'checkout requires a choice for products with required variants'
);
select throws_ok(
 $$select public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"aa300000-0000-4000-8000-000000000001","quantity":1,"variant_option_id":"b9000000-0000-4000-8000-000000000002"}]'::jsonb,'qris','aa000000-0000-4000-8000-000000000006',null,0)$$,
 '22023', null, 'checkout rejects a variant option from another tenant'
);
select lives_ok(
 $$select public.kasir_create_sale('a1000000-0000-4000-8000-000000000001','[{"product_id":"aa300000-0000-4000-8000-000000000001","quantity":2,"variant_option_id":"aa900000-0000-4000-8000-000000000002"}]'::jsonb,'qris','aa000000-0000-4000-8000-000000000005',null,0)$$,
 'checkout accepts a valid variant option'
);
select is((select total_amount from public.kasir_sales where idempotency_key='aa000000-0000-4000-8000-000000000005'),11000::bigint,'checkout computes variant price from its saved delta');
select is((select unit_price from public.kasir_sale_items where sale_id=(select id from public.kasir_sales where idempotency_key='aa000000-0000-4000-8000-000000000005')),5500::bigint,'checkout snapshots the final unit price');
select is((select stock_qty from public.kasir_products where id='aa300000-0000-4000-8000-000000000001'),3::numeric,'checkout decrements stock for the selected variant');
do $$ begin
 perform public.kasir_close_shift((select id from public.kasir_shifts where cashier_id='a0000000-0000-4000-8000-000000000001' and status='open'),2300,null);
end $$;
select is((select expected_cash from public.kasir_shifts where cashier_id='a0000000-0000-4000-8000-000000000001' and status='closed' order by opened_at desc limit 1),2300::bigint,'closing cash includes opening balance, cash sale, cash in and cash out');

reset role;
select * from finish();
rollback;

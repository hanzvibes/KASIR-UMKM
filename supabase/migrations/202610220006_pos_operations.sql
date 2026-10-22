-- Daily POS operations: business profile, active staff, outlets, products metadata and shifts.
-- Additive migration for existing FinanceTracker data; apply to development first.
create extension if not exists pgcrypto;

alter table public.kasir_businesses add column if not exists business_type text not null default 'lainnya';
alter table public.kasir_businesses add column if not exists address text;
alter table public.kasir_businesses add column if not exists phone text;
alter table public.kasir_businesses add column if not exists logo_url text;
alter table public.kasir_businesses add column if not exists qris_image_url text;
alter table public.kasir_businesses add column if not exists receipt_footer text;
alter table public.kasir_businesses add column if not exists receipt_width integer not null default 58 check (receipt_width in (58,80));
alter table public.kasir_business_members add column if not exists name text;
alter table public.kasir_business_members add column if not exists active boolean not null default true;
alter table public.kasir_business_members drop constraint if exists kasir_business_members_role_check;
update public.kasir_business_members set role='cashier' where role='staff';
alter table public.kasir_business_members add constraint kasir_business_members_role_check check (role in ('owner','cashier'));
alter table public.kasir_products add column if not exists deleted_at timestamptz;

create table if not exists public.kasir_outlets (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 name text not null default 'Utama', is_default boolean not null default true, created_at timestamptz not null default now(),
 unique (business_id,id)
);
create unique index if not exists kasir_one_default_outlet on public.kasir_outlets(business_id) where is_default;
insert into public.kasir_outlets(business_id,name,is_default)
select b.id,'Utama',true from public.kasir_businesses b
where not exists(select 1 from public.kasir_outlets o where o.business_id=b.id and o.is_default);
create table if not exists public.kasir_shifts (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 outlet_id uuid, cashier_id uuid not null references auth.users(id), opened_at timestamptz not null default now(), closed_at timestamptz,
 opening_cash bigint not null check(opening_cash>=0), expected_cash bigint, actual_cash bigint, difference bigint, note text,
 status text not null default 'open' check(status in ('open','closed')), created_at timestamptz not null default now(),
 foreign key (business_id,outlet_id) references public.kasir_outlets(business_id,id), unique (business_id,id)
);
create unique index if not exists kasir_one_open_shift_per_cashier on public.kasir_shifts(cashier_id) where status='open';
create index if not exists kasir_shifts_business_opened_idx on public.kasir_shifts(business_id,opened_at desc);
create table if not exists public.kasir_shift_cash_movements (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 shift_id uuid not null, movement_type text not null check(movement_type in ('cash_in','cash_out')),
 amount bigint not null check(amount>0), reason text not null check(length(trim(reason)) between 1 and 240),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key (business_id,shift_id) references public.kasir_shifts(business_id,id) on delete cascade
);
create table if not exists public.kasir_product_variant_groups (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 product_id uuid not null, name text not null check(length(trim(name)) between 1 and 80), required boolean not null default false,
 foreign key (business_id,product_id) references public.kasir_products(business_id,id) on delete cascade, unique(business_id,id)
);
create table if not exists public.kasir_product_variant_options (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 group_id uuid not null, name text not null check(length(trim(name)) between 1 and 80), price_delta bigint not null default 0,
 foreign key (business_id,group_id) references public.kasir_product_variant_groups(business_id,id) on delete cascade
);
create table if not exists public.kasir_audit_logs (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 actor_id uuid references auth.users(id), action text not null, entity text not null, entity_id uuid, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create table if not exists public.kasir_plan_limits (
 plan_code text primary key, max_products integer not null, max_cashiers integer not null
);
insert into public.kasir_plan_limits(plan_code,max_products,max_cashiers) values('free',100,2) on conflict do nothing;
alter table public.kasir_sales add column if not exists shift_id uuid;
alter table public.kasir_sales add column if not exists discount bigint not null default 0;
alter table public.kasir_sales add column if not exists public_receipt_token uuid not null default gen_random_uuid();
alter table public.kasir_sales add column if not exists invoice_no text;
alter table public.kasir_sales add column if not exists paid bigint;
alter table public.kasir_sales add column if not exists outlet_id uuid;
alter table public.kasir_sale_items add column if not exists outlet_id uuid;
create table if not exists public.kasir_invoice_sequences (
 business_id uuid not null references public.kasir_businesses(id) on delete cascade,
 sale_date date not null, last_value integer not null check(last_value>0), primary key(business_id,sale_date)
);
create unique index if not exists kasir_sales_invoice_unique on public.kasir_sales(business_id,invoice_no) where invoice_no is not null;
alter table public.kasir_products alter column price type bigint using round(price)::bigint;
alter table public.kasir_products alter column cost_price type bigint using round(cost_price)::bigint;
alter table public.kasir_sales alter column total_amount type bigint using round(total_amount)::bigint;
alter table public.kasir_sales alter column cash_received type bigint using round(cash_received)::bigint;
alter table public.kasir_sales alter column change_due type bigint using round(change_due)::bigint;
alter table public.kasir_sale_items alter column unit_price type bigint using round(unit_price)::bigint;
alter table public.kasir_sale_items alter column unit_cost type bigint using round(unit_cost)::bigint;
alter table public.kasir_sale_items alter column line_total type bigint using round(line_total)::bigint;
alter table public.kasir_expenses alter column amount type bigint using round(amount)::bigint;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='kasir_sales_shift_business_fk') then
  alter table public.kasir_sales add constraint kasir_sales_shift_business_fk foreign key(business_id,shift_id) references public.kasir_shifts(business_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='kasir_sales_outlet_business_fk') then
  alter table public.kasir_sales add constraint kasir_sales_outlet_business_fk foreign key(business_id,outlet_id) references public.kasir_outlets(business_id,id);
 end if;
 if not exists(select 1 from pg_constraint where conname='kasir_sale_items_outlet_business_fk') then
  alter table public.kasir_sale_items add constraint kasir_sale_items_outlet_business_fk foreign key(business_id,outlet_id) references public.kasir_outlets(business_id,id);
 end if;
end $$;
create index if not exists kasir_sales_shift_idx on public.kasir_sales(shift_id);
create index if not exists kasir_sales_business_created_idx on public.kasir_sales(business_id,created_at desc);

create or replace function public.kasir_is_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.kasir_business_members bm where bm.business_id=target_business_id and bm.user_id=(select auth.uid()) and bm.active); $$;

create or replace function public.kasir_get_my_business()
returns table(business_id uuid,role text)
language sql stable security definer set search_path=''
as $$ select bm.business_id,bm.role from public.kasir_business_members bm where bm.user_id=(select auth.uid()) and bm.active order by bm.created_at asc limit 1; $$;
revoke all on function public.kasir_get_my_business() from public;
grant execute on function public.kasir_get_my_business() to authenticated;
create or replace function public.kasir_login_allowed()
returns boolean language sql stable security definer set search_path=''
as $$ select not exists(select 1 from public.kasir_business_members bm where bm.user_id=(select auth.uid()) and not bm.active); $$;
revoke all on function public.kasir_login_allowed() from public;
grant execute on function public.kasir_login_allowed() to authenticated;
create or replace function public.kasir_load_sample_data(p_business_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare drinks uuid; snacks uuid;
begin
 if not exists(select 1 from public.kasir_business_members where business_id=p_business_id and user_id=(select auth.uid()) and role='owner' and active) then raise exception 'Owner access required' using errcode='42501'; end if;
 insert into public.kasir_categories(business_id,name) values(p_business_id,'Minuman') on conflict(business_id,name) do nothing;
 insert into public.kasir_categories(business_id,name) values(p_business_id,'Makanan ringan') on conflict(business_id,name) do nothing;
 select id into drinks from public.kasir_categories where business_id=p_business_id and name='Minuman';
 select id into snacks from public.kasir_categories where business_id=p_business_id and name='Makanan ringan';
 insert into public.kasir_products(business_id,category_id,name,sku,unit,price,cost_price,stock_qty,track_stock)
 values
  (p_business_id,drinks,'Kopi susu','SAMPLE-KOPI','gelas',15000,7000,20,true),
  (p_business_id,drinks,'Es teh','SAMPLE-ESTEH','gelas',5000,1500,30,true),
  (p_business_id,snacks,'Roti cokelat','SAMPLE-ROTI','pcs',8000,4000,15,true)
 on conflict do nothing;
end $$;
revoke all on function public.kasir_load_sample_data(uuid) from public;
grant execute on function public.kasir_load_sample_data(uuid) to authenticated;

create or replace function public.kasir_create_business(business_name text,business_type text,p_load_sample boolean)
returns uuid language plpgsql security definer set search_path=''
as $$
declare bid uuid;
begin
 if business_type not in('makanan','minuman','retail','jasa','lainnya') then raise exception 'Invalid business type' using errcode='22023'; end if;
 bid:=public.kasir_create_business(business_name);
 update public.kasir_businesses set business_type=kasir_create_business.business_type where id=bid and created_by=(select auth.uid());
 if coalesce(p_load_sample,false) then perform public.kasir_load_sample_data(bid); end if;
 return bid;
end $$;
drop function if exists public.kasir_create_business(text,text);
revoke all on function public.kasir_create_business(text,text,boolean) from public;
grant execute on function public.kasir_create_business(text,text,boolean) to authenticated;

create or replace function public.kasir_open_shift(p_opening_cash bigint)
returns uuid language plpgsql security definer set search_path=''
as $$
declare bid uuid; sid uuid; outlet uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_opening_cash is null or p_opening_cash<0 then raise exception 'Invalid opening cash' using errcode='22023'; end if;
 select business_id into bid from public.kasir_business_members where user_id=(select auth.uid()) and active limit 1;
 if bid is null then raise exception 'Active membership required' using errcode='42501'; end if;
 insert into public.kasir_outlets(business_id,name,is_default) values(bid,'Utama',true) on conflict do nothing;
 select id into outlet from public.kasir_outlets where business_id=bid and is_default limit 1;
 insert into public.kasir_shifts(business_id,outlet_id,cashier_id,opening_cash) values(bid,outlet,(select auth.uid()),p_opening_cash) returning id into sid;
 return sid;
end $$;
revoke all on function public.kasir_open_shift(bigint) from public;
grant execute on function public.kasir_open_shift(bigint) to authenticated;

create or replace function public.kasir_close_shift(p_shift_id uuid,p_actual_cash bigint,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare s public.kasir_shifts%rowtype; sales_cash bigint; inflow bigint; outflow bigint; expected bigint;
begin
 select * into s from public.kasir_shifts where id=p_shift_id for update;
 if not found then raise exception 'Shift not found' using errcode='P0002'; end if;
 if s.cashier_id<>(select auth.uid()) and not exists(select 1 from public.kasir_business_members where business_id=s.business_id and user_id=(select auth.uid()) and role='owner' and active) then raise exception 'Shift access denied' using errcode='42501'; end if;
 if s.status<>'open' then raise exception 'Shift already closed' using errcode='22023'; end if;
 if p_actual_cash is null or p_actual_cash<0 or p_actual_cash<>trunc(p_actual_cash) then raise exception 'Invalid counted cash' using errcode='22023'; end if;
 select coalesce(sum(total_amount),0)::bigint into sales_cash from public.kasir_sales where shift_id=s.id and payment_method='cash' and status='completed';
 select coalesce(sum(amount) filter(where movement_type='cash_in'),0)::bigint,coalesce(sum(amount) filter(where movement_type='cash_out'),0)::bigint into inflow,outflow from public.kasir_shift_cash_movements where shift_id=s.id;
 expected:=s.opening_cash+sales_cash+inflow-outflow;
 update public.kasir_shifts set status='closed',closed_at=now(),expected_cash=expected,actual_cash=p_actual_cash,difference=p_actual_cash-expected,note=nullif(trim(p_note),'' ) where id=s.id;
 return jsonb_build_object('opening_cash',s.opening_cash,'cash_sales',sales_cash,'cash_in',inflow,'cash_out',outflow,'expected_cash',expected,'actual_cash',p_actual_cash,'difference',p_actual_cash-expected);
end $$;
revoke all on function public.kasir_close_shift(uuid,bigint,text) from public;
grant execute on function public.kasir_close_shift(uuid,bigint,text) to authenticated;

create or replace function public.kasir_add_cash_movement(p_shift_id uuid,p_type text,p_amount bigint,p_reason text)
returns uuid language plpgsql security definer set search_path=''
as $$
declare s public.kasir_shifts%rowtype; movement uuid;
begin
 select * into s from public.kasir_shifts where id=p_shift_id for update;
 if not found or s.cashier_id<>(select auth.uid()) or s.status<>'open' then raise exception 'Open shift required' using errcode='42501'; end if;
 if p_type not in('cash_in','cash_out') or p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) or p_reason is null or length(trim(p_reason)) not between 1 and 240 then raise exception 'Invalid cash movement' using errcode='22023'; end if;
 insert into public.kasir_shift_cash_movements(business_id,shift_id,movement_type,amount,reason,created_by) values(s.business_id,s.id,p_type,p_amount,trim(p_reason),(select auth.uid())) returning id into movement;
 return movement;
end $$;
revoke all on function public.kasir_add_cash_movement(uuid,text,bigint,text) from public;
grant execute on function public.kasir_add_cash_movement(uuid,text,bigint,text) to authenticated;

create or replace function public.kasir_shift_summary(p_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare s public.kasir_shifts%rowtype; cash_total bigint; qris_total bigint; transfer_total bigint; cash_in_total bigint; cash_out_total bigint; tx_count bigint; void_count bigint;
begin
 select * into s from public.kasir_shifts where id=p_shift_id;
 if not found or not public.kasir_is_business_member(s.business_id) or (s.cashier_id<>(select auth.uid()) and not exists(select 1 from public.kasir_business_members where business_id=s.business_id and user_id=(select auth.uid()) and role='owner' and active)) then raise exception 'Shift access denied' using errcode='42501'; end if;
 select coalesce(sum(total_amount) filter(where payment_method='cash' and status='completed'),0),coalesce(sum(total_amount) filter(where payment_method='qris' and status='completed'),0),coalesce(sum(total_amount) filter(where payment_method='transfer' and status='completed'),0),count(*) filter(where status='completed'),count(*) filter(where status='voided') into cash_total,qris_total,transfer_total,tx_count,void_count from public.kasir_sales where shift_id=s.id;
 select coalesce(sum(amount) filter(where movement_type='cash_in'),0),coalesce(sum(amount) filter(where movement_type='cash_out'),0) into cash_in_total,cash_out_total from public.kasir_shift_cash_movements where shift_id=s.id;
 return jsonb_build_object('cash_sales',cash_total,'qris_sales',qris_total,'transfer_sales',transfer_total,'cash_in',cash_in_total,'cash_out',cash_out_total,'transaction_count',tx_count,'void_count',void_count,'expected_cash',s.opening_cash+cash_total+cash_in_total-cash_out_total);
end $$;
revoke all on function public.kasir_shift_summary(uuid) from public;
grant execute on function public.kasir_shift_summary(uuid) to authenticated;

create or replace function public.kasir_create_sale(p_business_id uuid,p_items jsonb,p_payment_method text,p_idempotency_key uuid,p_cash_received numeric,p_discount bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sale_id uuid; sale_total numeric(14,0):=0; subtotal_value numeric(14,0):=0; item_row record; product_row public.kasir_products%rowtype; qty numeric(14,3); line_total numeric(14,0); current_shift uuid; current_outlet uuid; invoice text; seq integer; local_date date;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not exists(select 1 from public.kasir_business_members where business_id=p_business_id and user_id=(select auth.uid()) and active) then raise exception 'Business access denied' using errcode='42501'; end if;
 select id,outlet_id into current_shift,current_outlet from public.kasir_shifts where business_id=p_business_id and cashier_id=(select auth.uid()) and status='open' for update;
 if current_shift is null then raise exception 'Open shift required' using errcode='22023'; end if;
 if p_payment_method not in('cash','qris','transfer') or p_idempotency_key is null then raise exception 'Invalid payment method or idempotency key' using errcode='22023'; end if;
 if p_discount is null or p_discount<0 then raise exception 'Invalid discount' using errcode='22023'; end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception 'Invalid cart' using errcode='22023'; end if;
 insert into public.kasir_sales(business_id,created_by,payment_method,idempotency_key,shift_id,outlet_id) values(p_business_id,(select auth.uid()),p_payment_method,p_idempotency_key,current_shift,current_outlet) on conflict(business_id,idempotency_key) do nothing returning id into sale_id;
 if sale_id is null then select id into sale_id from public.kasir_sales where business_id=p_business_id and idempotency_key=p_idempotency_key; return jsonb_build_object('id',sale_id,'duplicate',true); end if;
 for item_row in select (v->>'product_id')::uuid product_id,sum((v->>'quantity')::numeric)::numeric(14,3) quantity from jsonb_array_elements(p_items) v group by 1 order by 1 loop
  qty:=item_row.quantity; if qty is null or qty<=0 or qty>1000000 then raise exception 'Invalid quantity' using errcode='22023'; end if;
  select * into product_row from public.kasir_products where id=item_row.product_id and business_id=p_business_id and deleted_at is null for update;
  if not found or not product_row.is_active then raise exception 'Product not found or inactive' using errcode='22023'; end if;
  if product_row.track_stock then if product_row.stock_qty is null or product_row.stock_qty<qty then raise exception 'Insufficient stock' using errcode='22023'; end if; update public.kasir_products set stock_qty=stock_qty-qty,updated_at=now() where id=product_row.id;
   insert into public.kasir_stock_movements(business_id,product_id,sale_id,movement_type,quantity_delta,note,created_by) values(p_business_id,product_row.id,sale_id,'sale',-qty,'Penjualan',(select auth.uid())); end if;
  line_total:=round(product_row.price*qty); subtotal_value:=subtotal_value+line_total;
  insert into public.kasir_sale_items(business_id,sale_id,product_id,product_name,unit,quantity,unit_price,unit_cost,line_total,outlet_id) values(p_business_id,sale_id,product_row.id,product_row.name,product_row.unit,qty,product_row.price,product_row.cost_price,line_total,current_outlet);
 end loop;
 if p_discount>subtotal_value then raise exception 'Discount cannot exceed subtotal' using errcode='22023'; end if;
 sale_total:=subtotal_value-p_discount;
 if p_payment_method='cash' and (p_cash_received is null or p_cash_received<sale_total or p_cash_received<>trunc(p_cash_received)) then raise exception 'Cash received must cover total' using errcode='22023'; end if;
 local_date:=(now() at time zone 'Asia/Jakarta')::date;
 insert into public.kasir_invoice_sequences(business_id,sale_date,last_value) values(p_business_id,local_date,1)
 on conflict(business_id,sale_date) do update set last_value=public.kasir_invoice_sequences.last_value+1 returning last_value into seq;
 invoice:='INV-'||to_char(local_date,'YYYYMMDD')||'-'||lpad(seq::text,4,'0');
 update public.kasir_sales set total_amount=sale_total,discount=p_discount,paid=case when p_payment_method='cash' then p_cash_received else sale_total end,cash_received=case when p_payment_method='cash' then p_cash_received else null end,change_due=case when p_payment_method='cash' then p_cash_received-sale_total else 0 end,invoice_no=invoice where id=sale_id;
 return jsonb_build_object('id',sale_id,'subtotal',subtotal_value,'discount',p_discount,'total_amount',sale_total,'invoice_no',invoice,'duplicate',false);
end $$;
drop function if exists public.kasir_create_sale(uuid,jsonb,text,uuid,numeric);
revoke all on function public.kasir_create_sale(uuid,jsonb,text,uuid,numeric,bigint) from public;
grant execute on function public.kasir_create_sale(uuid,jsonb,text,uuid,numeric,bigint) to authenticated;

create or replace function public.kasir_void_sale(p_sale_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare sale_row public.kasir_sales%rowtype; item_row record;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 3 and 240 then raise exception 'Invalid reason' using errcode='22023'; end if;
 select * into sale_row from public.kasir_sales where id=p_sale_id for update;
 if not found then raise exception 'Sale not found' using errcode='P0002'; end if;
 if not exists(select 1 from public.kasir_business_members where business_id=sale_row.business_id and user_id=(select auth.uid()) and role='owner' and active) then raise exception 'Owner access required' using errcode='42501'; end if;
 if sale_row.shift_id is not null and exists(select 1 from public.kasir_shifts where id=sale_row.shift_id and status='closed') then raise exception 'Cannot void a transaction in a closed shift' using errcode='22023'; end if;
 if sale_row.status='voided' then return jsonb_build_object('id',sale_row.id,'status','voided','duplicate',true); end if;
 for item_row in select product_id,sum(quantity)::numeric(14,3) quantity from public.kasir_sale_items where sale_id=sale_row.id and business_id=sale_row.business_id and product_id is not null group by product_id order by product_id loop
  update public.kasir_products set stock_qty=stock_qty+item_row.quantity,updated_at=now() where id=item_row.product_id and business_id=sale_row.business_id and track_stock=true;
  if found then insert into public.kasir_stock_movements(business_id,product_id,sale_id,movement_type,quantity_delta,note,created_by) values(sale_row.business_id,item_row.product_id,sale_row.id,'sale_void',item_row.quantity,trim(p_reason),(select auth.uid())); end if;
 end loop;
 update public.kasir_sales set status='voided',voided_at=now(),voided_by=(select auth.uid()),void_reason=trim(p_reason) where id=sale_row.id;
 insert into public.kasir_audit_logs(business_id,actor_id,action,entity,entity_id,details) values(sale_row.business_id,(select auth.uid()),'void','sale',sale_row.id,jsonb_build_object('reason',trim(p_reason)));
 return jsonb_build_object('id',sale_row.id,'status','voided','duplicate',false);
end $$;
revoke all on function public.kasir_void_sale(uuid,text) from public;
grant execute on function public.kasir_void_sale(uuid,text) to authenticated;

create or replace function public.kasir_audit_product_price()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if old.price is distinct from new.price then
  insert into public.kasir_audit_logs(business_id,actor_id,action,entity,entity_id,details)
  values(new.business_id,(select auth.uid()),'price_update','product',new.id,jsonb_build_object('old_price',old.price,'new_price',new.price));
 end if;
 return new;
end $$;
drop trigger if exists kasir_product_price_audit on public.kasir_products;
create trigger kasir_product_price_audit after update of price on public.kasir_products for each row execute function public.kasir_audit_product_price();

create or replace function public.kasir_enforce_free_limits()
returns trigger language plpgsql security definer set search_path=''
as $$
declare product_limit integer; cashier_limit integer;
begin
 select max_products,max_cashiers into product_limit,cashier_limit from public.kasir_plan_limits where plan_code='free';
 if tg_table_name='kasir_products' and tg_op='INSERT' then
  if (select count(*) from public.kasir_products where business_id=new.business_id and deleted_at is null)>=product_limit then raise exception 'Product plan limit reached' using errcode='23514'; end if;
 elsif tg_table_name='kasir_business_members' and (tg_op='INSERT' or old.active is distinct from new.active or old.role is distinct from new.role) then
  if new.role='cashier' and new.active and (select count(*) from public.kasir_business_members where business_id=new.business_id and role='cashier' and active and (tg_op='INSERT' or user_id<>new.user_id))>=cashier_limit then raise exception 'Cashier plan limit reached' using errcode='23514'; end if;
 end if;
 return new;
end $$;
drop trigger if exists kasir_products_plan_limit on public.kasir_products;
create trigger kasir_products_plan_limit before insert on public.kasir_products for each row execute function public.kasir_enforce_free_limits();
drop trigger if exists kasir_members_plan_limit on public.kasir_business_members;
create trigger kasir_members_plan_limit before insert or update on public.kasir_business_members for each row execute function public.kasir_enforce_free_limits();

create or replace function public.kasir_audit_membership_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if tg_op='INSERT' then
  insert into public.kasir_audit_logs(business_id,actor_id,action,entity,entity_id,details) values(new.business_id,(select auth.uid()),'user_added','membership',new.user_id,jsonb_build_object('role',new.role,'active',new.active));
 else
  insert into public.kasir_audit_logs(business_id,actor_id,action,entity,entity_id,details) values(new.business_id,(select auth.uid()),'user_updated','membership',new.user_id,jsonb_build_object('role',new.role,'active',new.active));
 end if;
 return new;
end $$;
drop trigger if exists kasir_membership_audit on public.kasir_business_members;
create trigger kasir_membership_audit after insert or update on public.kasir_business_members for each row execute function public.kasir_audit_membership_change();

create or replace function public.kasir_public_receipt(p_token uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
  'sale',jsonb_build_object('invoice_no',s.invoice_no,'total_amount',s.total_amount,'discount',s.discount,'payment_method',s.payment_method,'created_at',s.created_at,'status',s.status,'cash_received',s.cash_received,'change_due',s.change_due),
  'business',jsonb_build_object('name',b.name,'phone',b.phone,'logo_url',b.logo_url,'receipt_footer',b.receipt_footer,'receipt_width',b.receipt_width),
  'items',coalesce((select jsonb_agg(jsonb_build_object('name',i.product_name,'unit',i.unit,'quantity',i.quantity,'price',i.unit_price,'total',i.line_total) order by i.created_at) from public.kasir_sale_items i where i.sale_id=s.id),'[]'::jsonb)
 ) from public.kasir_sales s join public.kasir_businesses b on b.id=s.business_id
 where s.public_receipt_token=p_token and s.status='completed';
$$;
revoke all on function public.kasir_public_receipt(uuid) from public;
grant execute on function public.kasir_public_receipt(uuid) to anon,authenticated;

alter table public.kasir_outlets enable row level security;
alter table public.kasir_shifts enable row level security;
alter table public.kasir_shift_cash_movements enable row level security;
alter table public.kasir_product_variant_groups enable row level security;
alter table public.kasir_product_variant_options enable row level security;
alter table public.kasir_audit_logs enable row level security;
alter table public.kasir_plan_limits enable row level security;
alter table public.kasir_invoice_sequences enable row level security;
create policy "Tenant reads outlets" on public.kasir_outlets for select to authenticated using(public.kasir_is_business_member(business_id));
create policy "Owners update own business" on public.kasir_businesses for update to authenticated using(exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_businesses.id and bm.user_id=(select auth.uid()) and bm.role='owner' and bm.active)) with check(exists(select 1 from public.kasir_business_members bm where bm.business_id=kasir_businesses.id and bm.user_id=(select auth.uid()) and bm.role='owner' and bm.active));
create policy "Tenant reads shifts" on public.kasir_shifts for select to authenticated using(public.kasir_is_business_member(business_id) and (cashier_id=(select auth.uid()) or exists(select 1 from public.kasir_business_members where business_id=kasir_shifts.business_id and user_id=(select auth.uid()) and role='owner' and active)));
create policy "Tenant reads cash movements" on public.kasir_shift_cash_movements for select to authenticated using(public.kasir_is_business_member(business_id) and exists(select 1 from public.kasir_shifts sh where sh.id=shift_id and sh.business_id=kasir_shift_cash_movements.business_id and (sh.cashier_id=(select auth.uid()) or exists(select 1 from public.kasir_business_members bm where bm.business_id=sh.business_id and bm.user_id=(select auth.uid()) and bm.role='owner'))));
create policy "Tenant reads product variants" on public.kasir_product_variant_groups for select to authenticated using(public.kasir_is_business_member(business_id));
create policy "Tenant reads variant options" on public.kasir_product_variant_options for select to authenticated using(public.kasir_is_business_member(business_id));
create policy "Tenant reads audit logs" on public.kasir_audit_logs for select to authenticated using(public.kasir_is_business_member(business_id));
create policy "Read plan limits" on public.kasir_plan_limits for select to authenticated using(true);
create policy "Tenant reads invoice sequences" on public.kasir_invoice_sequences for select to authenticated using(public.kasir_is_business_member(business_id));
grant select on public.kasir_outlets,public.kasir_shifts,public.kasir_shift_cash_movements,public.kasir_product_variant_groups,public.kasir_product_variant_options,public.kasir_audit_logs,public.kasir_plan_limits,public.kasir_invoice_sequences to authenticated;
grant update on public.kasir_businesses to authenticated;
grant insert,update,delete on public.kasir_product_variant_groups,public.kasir_product_variant_options to authenticated;

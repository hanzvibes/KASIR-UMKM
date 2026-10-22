-- Local-only demo account. Do not use this password outside a disposable local stack.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (
  'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'demo@kasir-umkm.test', crypt('demo-kasir-local-only', gen_salt('bf')), now(), now(), now()
) on conflict (id) do nothing;
insert into auth.identities (id,user_id,identity_data,provider,provider_id,created_at,updated_at)
values (
  'd2000000-0000-4000-8000-000000000001',
  'd0000000-0000-4000-8000-000000000001',
  '{"sub":"d0000000-0000-4000-8000-000000000001","email":"demo@kasir-umkm.test","email_verified":true}',
  'email','demo@kasir-umkm.test',now(),now()
) on conflict (provider,provider_id) do nothing;

insert into public.kasir_businesses(id,name,business_type,created_by)
values ('d1000000-0000-4000-8000-000000000001','Warung Contoh','makanan','d0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
insert into public.kasir_business_members(business_id,user_id,role,name,active)
values ('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','owner','Pemilik Demo',true)
on conflict (business_id,user_id) do nothing;

select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.kasir_load_sample_data('d1000000-0000-4000-8000-000000000001');
reset role;

commit;

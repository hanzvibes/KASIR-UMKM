-- Expense tracking for the current business.
-- Apply only to a development/staging Supabase project after review.

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null check (length(trim(category)) between 1 and 80),
  description text check (description is null or length(description) <= 240),
  amount numeric(14,0) not null check (amount > 0),
  expense_date date not null default (now() at time zone 'Asia/Jakarta')::date,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index expenses_business_date_idx on public.expenses(business_id, expense_date desc);

alter table public.expenses enable row level security;

create policy "Members can read expenses"
on public.expenses for select to authenticated
using (public.is_business_member(business_id));

create policy "Owners can insert expenses"
on public.expenses for insert to authenticated
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = expenses.business_id
    and bm.user_id = (select auth.uid())
    and bm.role = 'owner'
));

create policy "Owners can update expenses"
on public.expenses for update to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = expenses.business_id
    and bm.user_id = (select auth.uid())
    and bm.role = 'owner'
))
with check (exists (
  select 1 from public.business_members bm
  where bm.business_id = expenses.business_id
    and bm.user_id = (select auth.uid())
    and bm.role = 'owner'
));

create policy "Owners can delete expenses"
on public.expenses for delete to authenticated
using (exists (
  select 1 from public.business_members bm
  where bm.business_id = expenses.business_id
    and bm.user_id = (select auth.uid())
    and bm.role = 'owner'
));

grant select, insert, update, delete on public.expenses to authenticated;

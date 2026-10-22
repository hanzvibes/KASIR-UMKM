-- Checkout inserts a pending sale before it computes and writes the final total.
-- Some existing projects created kasir_sales before this table default existed.
alter table public.kasir_sales
  alter column total_amount set default 0;

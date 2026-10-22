-- Supabase can grant newly created functions directly to anon by default.
-- Private POS SECURITY DEFINER functions should only be callable by members.
do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'kasir_%'
      and p.prosecdef
      and p.proname <> 'kasir_public_receipt'
  loop
    execute format('revoke execute on function %I.%I(%s) from anon', function_row.nspname, function_row.proname, function_row.arguments);
  end loop;
end;
$$;

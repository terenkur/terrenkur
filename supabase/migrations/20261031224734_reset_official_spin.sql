create or replace function public.reset_official_spin(target_poll_id integer)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.polls where id = target_poll_id and archived = false for update;
  if not found then
    raise exception 'Poll is no longer active' using errcode = 'P0002';
  end if;
  delete from public.poll_results where poll_id = target_poll_id;
  insert into public.settings(key, value) values ('official_spin_active', 0)
    on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function public.reset_official_spin(integer) from public, anon, authenticated;
grant execute on function public.reset_official_spin(integer) to service_role;

-- claim_share: OUT column names collided with share_grants columns inside plpgsql ("owner_id is ambiguous").
-- Prefix the OUT columns so the body's references stay unambiguous.

drop function if exists public.claim_share(text);

create or replace function public.claim_share(p_token text)
returns table (grant_owner_id uuid, grant_owner_name text, grant_depth text)
language plpgsql security definer set search_path = public as $$
declare
  l public.share_links%rowtype;
begin
  select * into l from public.share_links sl where sl.token = p_token;
  if not found then raise exception 'share link not found' using errcode = 'P0002'; end if;
  if l.owner_id = auth.uid() then raise exception 'cannot claim your own share link' using errcode = 'P0001'; end if;
  insert into public.share_grants as g (owner_id, viewer_id, depth) values (l.owner_id, auth.uid(), l.depth)
  on conflict (owner_id, viewer_id) do update
    set depth = case when excluded.depth = 'full' then 'full' else g.depth end;
  return query select p.id, p.name, g2.depth
    from public.profiles p join public.share_grants g2 on g2.owner_id = p.id
    where p.id = l.owner_id and g2.viewer_id = auth.uid();
end $$;
revoke all on function public.claim_share(text) from public;
grant execute on function public.claim_share(text) to authenticated;

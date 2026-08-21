-- display_snapshot only returns boards the composer has not hidden. A board the owner unticked
-- (items[].show = false) is excluded server-side, so an anonymous display key cannot read it.
-- Boards with no composer item yet are still returned (the client shows them until configured).
create or replace function public.display_snapshot(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_owner uuid;
  v_from  date := current_date - 36;
  v_to    date := current_date + 2;
  v_items jsonb;
  result  jsonb;
begin
  select owner_id into v_owner from public.display_tokens where token = p_token;
  if v_owner is null then raise exception 'display token not found' using errcode = 'P0002'; end if;
  select coalesce(items, '[]'::jsonb) into v_items from public.board_config where owner_id = v_owner;
  v_items := coalesce(v_items, '[]'::jsonb);

  with boards as (
    select v_owner as id, 'full'::text as depth
    union all
    select g.owner_id, g.depth from public.share_grants g where g.viewer_id = v_owner
  ), visible as (
    select b.* from boards b
    where not exists (
      select 1 from jsonb_array_elements(v_items) it
      where it->>'ownerId' = b.id::text and coalesce((it->>'show')::boolean, true) = false
    )
  )
  select jsonb_build_object(
    'owner', jsonb_build_object('id', p.id, 'name', p.name, 'startDate', p.start_date),
    'items', v_items,
    'boards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'depth', b.depth,
        'name', bp.name, 'startDate', bp.start_date,
        'scores', coalesce((select jsonb_object_agg(s.day, s.score) from public.daily_scores s where s.owner_id = b.id and s.day between v_from and v_to), '{}'::jsonb),
        'ops', case when b.depth = 'full' then coalesce((
            select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'colour', o.colour, 'note', o.note, 'sort', o.sort, 'archive', o.archive) order by o.sort)
            from public.ops o where o.owner_id = b.id), '[]'::jsonb) else null end,
        'entries', case when b.depth = 'full' then coalesce((
            select jsonb_agg(jsonb_build_object('opId', e.op_id, 'day', e.day, 'state', e.state))
            from public.entries e where e.owner_id = b.id and e.day between v_from and v_to), '[]'::jsonb) else null end
      ))
      from visible b join public.profiles bp on bp.id = b.id
    ), '[]'::jsonb)
  ) into result
  from public.profiles p where p.id = v_owner;

  return result;
end $$;

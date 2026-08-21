-- Sharing controls (design S1-S12). One standing invite link at Summary, per-person OFF/SUMMARY/FULL,
-- a Pause-all switch, and a no-login public page. Visibility is decided in ONE place, effective_depth,
-- so every existing policy and the display snapshot inherit the silent cut-off rules (S7/S10).

-- ---------------------------------------------------------------- sharing_settings (S9, S12)
create table public.sharing_settings (
  owner_id      uuid primary key references public.profiles (id) on delete cascade,
  paused        boolean not null default false,
  public_token  text not null unique check (public_token ~ '^[A-Za-z0-9_-]{16,64}$'),
  public_depth  text not null default 'off' check (public_depth in ('off', 'summary', 'full')),
  updated_at    timestamptz not null default now()
);
alter table public.sharing_settings enable row level security;
create policy sharing_owner on public.sharing_settings for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------- grants gain 'off' (S1/S2)
alter table public.share_grants drop constraint share_grants_depth_check;
alter table public.share_grants add constraint share_grants_depth_check check (depth in ('off', 'summary', 'full'));

-- ---------------------------------------------------------------- one link, always Summary (S3/S5)
alter table public.share_links drop column depth;

-- ---------------------------------------------------------------- effective visibility
-- null when there is no grant, the grant is off, or the owner has paused sharing.
create or replace function public.effective_depth(p_owner uuid, p_viewer uuid)
returns text language sql stable security definer set search_path = public as $$
  select g.depth
  from public.share_grants g
  left join public.sharing_settings s on s.owner_id = g.owner_id
  where g.owner_id = p_owner and g.viewer_id = p_viewer
    and g.depth <> 'off' and not coalesce(s.paused, false)
$$;
revoke all on function public.effective_depth(uuid, uuid) from public, anon;
grant execute on function public.effective_depth(uuid, uuid) to authenticated;

-- Same signature as before: every policy that calls viewer_depth keeps working.
create or replace function public.viewer_depth(p_owner uuid)
returns text language sql stable security definer set search_path = public as $$
  select public.effective_depth(p_owner, auth.uid())
$$;

-- ---------------------------------------------------------------- share_grants policies
drop policy if exists grants_owner_select on public.share_grants;
create policy grants_owner_select on public.share_grants for select to authenticated using (owner_id = auth.uid());
create policy grants_viewer_select on public.share_grants for select to authenticated
  using (viewer_id = auth.uid() and public.effective_depth(owner_id, auth.uid()) is not null);
create policy grants_owner_update on public.share_grants for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------- claim_share: join at Summary, never override the owner
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
  insert into public.share_grants (owner_id, viewer_id, depth) values (l.owner_id, auth.uid(), 'summary')
  on conflict (owner_id, viewer_id) do nothing;
  return query select p.id, p.name, public.effective_depth(p.id, auth.uid())
    from public.profiles p where p.id = l.owner_id;
end $$;
revoke all on function public.claim_share(text) from public, anon;
grant execute on function public.claim_share(text) to authenticated;

-- ---------------------------------------------------------------- one board builder for both snapshots
create or replace function public.board_json(p_id uuid, p_depth text, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'depth', p_depth, 'name', p.name, 'startDate', p.start_date,
    'scores', coalesce((select jsonb_object_agg(s.day, s.score) from public.daily_scores s where s.owner_id = p.id and s.day between p_from and p_to), '{}'::jsonb),
    'ops', case when p_depth = 'full' then coalesce((
        select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'colour', o.colour, 'note', o.note, 'sort', o.sort, 'archive', o.archive) order by o.sort)
        from public.ops o where o.owner_id = p.id), '[]'::jsonb) else null end,
    'entries', case when p_depth = 'full' then coalesce((
        select jsonb_agg(jsonb_build_object('opId', e.op_id, 'day', e.day, 'state', e.state))
        from public.entries e where e.owner_id = p.id and e.day between p_from and p_to), '[]'::jsonb) else null end
  )
  from public.profiles p where p.id = p_id
$$;
revoke all on function public.board_json(uuid, text, date, date) from public, anon, authenticated;

-- ---------------------------------------------------------------- display_snapshot honours effective depth
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
    select g.owner_id, public.effective_depth(g.owner_id, v_owner) from public.share_grants g where g.viewer_id = v_owner
  ), visible as (
    select b.* from boards b
    where b.depth is not null
      and not exists (
        select 1 from jsonb_array_elements(v_items) it
        where it->>'ownerId' = b.id::text and coalesce((it->>'show')::boolean, true) = false
      )
  )
  select jsonb_build_object(
    'owner', jsonb_build_object('id', p.id, 'name', p.name, 'startDate', p.start_date),
    'items', v_items,
    'boards', coalesce((select jsonb_agg(public.board_json(b.id, b.depth, v_from, v_to)) from visible b), '[]'::jsonb)
  ) into result
  from public.profiles p where p.id = v_owner;

  return result;
end $$;

-- ---------------------------------------------------------------- public page (S12): the other anon-callable RPC
-- One board, shaped like display_snapshot, so the glass display renders it unchanged.
create or replace function public.public_snapshot(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.sharing_settings%rowtype;
  v_from  date := current_date - 36;
  v_to    date := current_date + 2;
begin
  select * into s from public.sharing_settings ss where ss.public_token = p_token and ss.public_depth <> 'off' and not ss.paused;
  if not found then raise exception 'public page not found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'owner', (select jsonb_build_object('id', p.id, 'name', p.name, 'startDate', p.start_date) from public.profiles p where p.id = s.owner_id),
    'items', jsonb_build_array(jsonb_build_object('ownerId', s.owner_id, 'show', true, 'featured', true, 'avg7', true, 'avg28', true, 'last7', true, 'ops', s.public_depth = 'full', 'mode', 'both')),
    'boards', jsonb_build_array(public.board_json(s.owner_id, s.public_depth, v_from, v_to))
  );
end $$;
revoke all on function public.public_snapshot(text) from public;
grant execute on function public.public_snapshot(text) to anon, authenticated;

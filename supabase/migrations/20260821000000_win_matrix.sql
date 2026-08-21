-- Win Matrix schema. Supabase stores and secures; product rules live in src/domain (R2).
-- Tables: profiles, ops, entries, daily_scores (derived, Q32), share_links, share_grants (Q31),
-- board_config, display_tokens (Q34). Two RPCs: claim_share, display_snapshot.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  start_date  date not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- ops
create table public.ops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  colour      text not null default '#3b5bdb',
  note        text not null default '',
  sort        integer not null default 0,
  -- [{"from":"YYYY-MM-DD","to":"YYYY-MM-DD"|null}, ...]  (D9, repeatable)
  archive     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index ops_owner_idx on public.ops (owner_id, sort);

-- ---------------------------------------------------------------- entries
create table public.entries (
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  op_id       uuid not null references public.ops (id) on delete cascade,
  day         date not null,
  state       text not null check (state in ('W', 'C', 'B')),
  updated_at  timestamptz not null default now(),
  primary key (op_id, day)
);
create index entries_owner_day_idx on public.entries (owner_id, day);

-- ---------------------------------------------------------------- daily_scores (derived)
create table public.daily_scores (
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  score       numeric(6, 3),                       -- null = no score that day
  updated_at  timestamptz not null default now(),
  primary key (owner_id, day)
);

-- ---------------------------------------------------------------- sharing
create table public.share_links (
  token       text primary key check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  depth       text not null check (depth in ('summary', 'full')),
  created_at  timestamptz not null default now()
);
create index share_links_owner_idx on public.share_links (owner_id);

create table public.share_grants (
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  viewer_id   uuid not null references public.profiles (id) on delete cascade,
  depth       text not null check (depth in ('summary', 'full')),
  created_at  timestamptz not null default now(),
  primary key (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);
create index share_grants_viewer_idx on public.share_grants (viewer_id);

-- ---------------------------------------------------------------- composer + display
create table public.board_config (
  owner_id    uuid primary key references public.profiles (id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,  -- BoardItem[] (src/domain/model.ts)
  updated_at  timestamptz not null default now()
);

create table public.display_tokens (
  token       text primary key check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
create or replace function public.viewer_depth(p_owner uuid)
returns text language sql stable security definer set search_path = public as $$
  select depth from public.share_grants where owner_id = p_owner and viewer_id = auth.uid()
$$;

-- ---------------------------------------------------------------- RLS
alter table public.profiles       enable row level security;
alter table public.ops            enable row level security;
alter table public.entries        enable row level security;
alter table public.daily_scores   enable row level security;
alter table public.share_links    enable row level security;
alter table public.share_grants   enable row level security;
alter table public.board_config   enable row level security;
alter table public.display_tokens enable row level security;

-- profiles: self, plus anyone who holds a grant from this owner (they need the name), plus owners of grants I hold (they need my name in their grants list)
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid()
      or public.viewer_depth(id) is not null
      or exists (select 1 from public.share_grants g where g.owner_id = auth.uid() and g.viewer_id = profiles.id));
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ops / entries: owner everything; full-depth viewers read
create policy ops_owner on public.ops for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ops_viewer on public.ops for select to authenticated using (public.viewer_depth(owner_id) = 'full');
create policy entries_owner on public.entries for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy entries_viewer on public.entries for select to authenticated using (public.viewer_depth(owner_id) = 'full');

-- daily_scores: owner everything; any viewer reads
create policy scores_owner on public.daily_scores for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy scores_viewer on public.daily_scores for select to authenticated using (public.viewer_depth(owner_id) is not null);

-- share_links: owner only (claims go through the RPC)
create policy links_owner on public.share_links for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- share_grants: owner sees and may delete; viewer sees own; inserts only via RPC
create policy grants_owner_select on public.share_grants for select to authenticated using (owner_id = auth.uid() or viewer_id = auth.uid());
create policy grants_owner_delete on public.share_grants for delete to authenticated using (owner_id = auth.uid());

-- board_config / display_tokens: owner only
create policy board_owner on public.board_config for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy display_owner on public.display_tokens for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------------- RPC: claim a share link (Q31)
-- Binds a grant to the caller at the link's depth. Re-claiming only ever raises depth.
create or replace function public.claim_share(p_token text)
returns table (owner_id uuid, owner_name text, depth text)
language plpgsql security definer set search_path = public as $$
declare
  l public.share_links%rowtype;
begin
  select * into l from public.share_links where token = p_token;
  if not found then raise exception 'share link not found' using errcode = 'P0002'; end if;
  if l.owner_id = auth.uid() then raise exception 'cannot claim your own share link' using errcode = 'P0001'; end if;
  insert into public.share_grants (owner_id, viewer_id, depth) values (l.owner_id, auth.uid(), l.depth)
  on conflict (owner_id, viewer_id) do update
    set depth = case when excluded.depth = 'full' then 'full' else public.share_grants.depth end;
  return query select l.owner_id, p.name, g.depth
    from public.profiles p join public.share_grants g on g.owner_id = p.id
    where p.id = l.owner_id and g.viewer_id = auth.uid();
end $$;
revoke all on function public.claim_share(text) from public;
grant execute on function public.claim_share(text) to authenticated;

-- ---------------------------------------------------------------- RPC: wall display snapshot (Q34)
-- The only thing the anonymous role can call. Returns the owner's composer config and, for every
-- board the owner may see (their own plus granted), the last 35 days of scores, plus ops and entries
-- where the depth is full. Product rules are NOT applied here; the client computes averages.
create or replace function public.display_snapshot(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_owner uuid;
  v_from  date := current_date - 36;
  v_to    date := current_date + 2;
  result  jsonb;
begin
  select owner_id into v_owner from public.display_tokens where token = p_token;
  if v_owner is null then raise exception 'display token not found' using errcode = 'P0002'; end if;

  with boards as (
    select v_owner as id, 'full'::text as depth
    union all
    select g.owner_id, g.depth from public.share_grants g where g.viewer_id = v_owner
  )
  select jsonb_build_object(
    'owner', jsonb_build_object('id', p.id, 'name', p.name, 'startDate', p.start_date),
    'items', coalesce((select items from public.board_config where owner_id = v_owner), '[]'::jsonb),
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
      from boards b join public.profiles bp on bp.id = b.id
    ), '[]'::jsonb)
  ) into result
  from public.profiles p where p.id = v_owner;

  return result;
end $$;
revoke all on function public.display_snapshot(text) from public;
grant execute on function public.display_snapshot(text) to anon, authenticated;

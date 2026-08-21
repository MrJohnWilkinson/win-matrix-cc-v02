-- Private channels need a user JWT; the anonymous wall display has none, so its channel can never be
-- read. Drop it: the display polls display_snapshot instead. Also revoke the anon grants that
-- Supabase's default privileges add to every new function.
drop policy if exists display_channel_read on realtime.messages;

create or replace function public.broadcast_scores()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select owner_id, jsonb_agg(jsonb_build_object('day', day, 'score', score) order by day) as changes from changed group by owner_id loop
    perform realtime.send(jsonb_build_object('ownerId', r.owner_id, 'changes', r.changes), 'scores', 'scores:' || r.owner_id::text, true);
  end loop;
  return null;
end $$;

revoke execute on function public.viewer_depth(uuid) from anon;
revoke execute on function public.claim_share(text) from anon;
revoke execute on function public.broadcast_scores() from anon, authenticated;

-- Live updates move server-side (Q34 hardening). The database broadcasts on PRIVATE channels after
-- every daily_scores write; clients only subscribe. Read access to a channel is gated by RLS on
-- realtime.messages: `scores:{ownerId}` for the owner and anyone holding a grant on them,
-- `display:{token}` for whoever holds that display token (the anonymous wall).

-- viewer_depth is security definer; keep it off the anonymous role.
revoke all on function public.viewer_depth(uuid) from public;
grant execute on function public.viewer_depth(uuid) to authenticated;

create or replace function public.broadcast_scores()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
  payload jsonb;
begin
  for r in select owner_id, jsonb_agg(jsonb_build_object('day', day, 'score', score) order by day) as changes from changed group by owner_id loop
    payload := jsonb_build_object('ownerId', r.owner_id, 'changes', r.changes);
    perform realtime.send(payload, 'scores', 'scores:' || r.owner_id::text, true);
    perform realtime.send(payload, 'scores', 'display:' || t.token, true)
      from public.display_tokens t
      where t.owner_id = r.owner_id
         or t.owner_id in (select g.viewer_id from public.share_grants g where g.owner_id = r.owner_id);
  end loop;
  return null;
end $$;

create trigger daily_scores_broadcast_ins after insert on public.daily_scores
  referencing new table as changed for each statement execute function public.broadcast_scores();
create trigger daily_scores_broadcast_upd after update on public.daily_scores
  referencing new table as changed for each statement execute function public.broadcast_scores();

create policy scores_channel_read on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() ~ '^scores:[0-9a-f-]{36}$'
    and (
      realtime.topic() = 'scores:' || auth.uid()::text
      or public.viewer_depth(substring(realtime.topic() from 8)::uuid) is not null
    )
  );

create policy display_channel_read on realtime.messages for select to anon, authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() like 'display:%'
    and exists (select 1 from public.display_tokens t where 'display:' || t.token = realtime.topic())
  );

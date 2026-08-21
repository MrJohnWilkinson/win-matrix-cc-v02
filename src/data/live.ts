// Live updates: the database broadcasts on private channels after each daily_scores write
// (trigger broadcast_scores). Signed-in clients subscribe to `scores:{ownerId}`; RLS on
// realtime.messages admits the owner and grant holders. The anonymous wall display has no user JWT,
// so it cannot join a private channel and polls display_snapshot instead.

import { supabase } from './client'
import type { IsoDate } from '../domain/model'

export interface ScoreEvent { ownerId: string; changes: { day: IsoDate; score: number | null }[] }

function open(topic: string, onEvent: (e: ScoreEvent) => void): () => void {
  const ch = supabase.channel(topic, { config: { private: true } })
  ch.on('broadcast', { event: 'scores' }, ({ payload }) => onEvent(payload as ScoreEvent))
  ch.subscribe()
  return () => { void supabase.removeChannel(ch) }
}

/** Subscribe to score events for a set of owners (signed-in). Returns an unsubscribe function. */
export function subscribeScores(ownerIds: readonly string[], onEvent: (e: ScoreEvent) => void): () => void {
  const offs = ownerIds.map((id) => open(`scores:${id}`, onEvent))
  return () => offs.forEach((off) => off())
}

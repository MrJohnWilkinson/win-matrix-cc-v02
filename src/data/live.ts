// Live updates: one broadcast channel per owner. Writers send after each score write; the composer and
// the wall display subscribe to the owners they show. Anonymous display pages can join (Q34).

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './client'
import type { IsoDate } from '../domain/model'

export interface ScoreEvent { ownerId: string; day: IsoDate; score: number | null }

const channels = new Map<string, RealtimeChannel>()

function channelFor(ownerId: string): RealtimeChannel {
  let ch = channels.get(ownerId)
  if (!ch) {
    ch = supabase.channel(`scores:${ownerId}`, { config: { broadcast: { self: false } } })
    channels.set(ownerId, ch)
  }
  return ch
}

/** Subscribe to score events for a set of owners. Returns an unsubscribe function. */
export function subscribeScores(ownerIds: readonly string[], onEvent: (e: ScoreEvent) => void): () => void {
  const mine = ownerIds.map((id) => {
    const ch = channelFor(id)
    ch.on('broadcast', { event: 'score' }, ({ payload }) => onEvent(payload as ScoreEvent))
    if (ch.state === 'closed') ch.subscribe()
    return ch
  })
  return () => { mine.forEach((ch) => { supabase.removeChannel(ch); channels.delete(ch.topic.replace('realtime:scores:', '').replace('scores:', '')) }) }
}

/** Publish score changes for the signed-in owner. Subscribes lazily; fire-and-forget. */
export async function publishScores(ownerId: string, changes: readonly { day: IsoDate; score: number | null }[]): Promise<void> {
  const ch = channelFor(ownerId)
  if (ch.state === 'closed') {
    await new Promise<void>((resolve) => ch.subscribe((status) => { if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') resolve() }))
  }
  for (const c of changes) {
    await ch.send({ type: 'broadcast', event: 'score', payload: { ownerId, day: c.day, score: c.score } satisfies ScoreEvent })
  }
}

// Database types. Hand-written to mirror supabase/migrations; regenerate with `npm run types` once the
// project is linked (supabase gen types). Keep this file free of product logic.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string; start_date: string; created_at: string }
        Insert: { id: string; name: string; start_date: string; created_at?: string }
        Update: { id?: string; name?: string; start_date?: string; created_at?: string }
        Relationships: []
      }
      ops: {
        Row: { id: string; owner_id: string; name: string; colour: string; note: string; sort: number; archive: Json; created_at: string }
        Insert: { id?: string; owner_id: string; name: string; colour?: string; note?: string; sort?: number; archive?: Json; created_at?: string }
        Update: { id?: string; owner_id?: string; name?: string; colour?: string; note?: string; sort?: number; archive?: Json; created_at?: string }
        Relationships: []
      }
      entries: {
        Row: { owner_id: string; op_id: string; day: string; state: string; updated_at: string }
        Insert: { owner_id: string; op_id: string; day: string; state: string; updated_at?: string }
        Update: { owner_id?: string; op_id?: string; day?: string; state?: string; updated_at?: string }
        Relationships: []
      }
      daily_scores: {
        Row: { owner_id: string; day: string; score: number | null; updated_at: string }
        Insert: { owner_id: string; day: string; score?: number | null; updated_at?: string }
        Update: { owner_id?: string; day?: string; score?: number | null; updated_at?: string }
        Relationships: []
      }
      share_links: {
        Row: { token: string; owner_id: string; depth: string; created_at: string }
        Insert: { token: string; owner_id: string; depth: string; created_at?: string }
        Update: { token?: string; owner_id?: string; depth?: string; created_at?: string }
        Relationships: []
      }
      share_grants: {
        Row: { owner_id: string; viewer_id: string; depth: string; created_at: string }
        Insert: { owner_id: string; viewer_id: string; depth: string; created_at?: string }
        Update: { owner_id?: string; viewer_id?: string; depth?: string; created_at?: string }
        Relationships: []
      }
      board_config: {
        Row: { owner_id: string; items: Json; updated_at: string }
        Insert: { owner_id: string; items?: Json; updated_at?: string }
        Update: { owner_id?: string; items?: Json; updated_at?: string }
        Relationships: []
      }
      display_tokens: {
        Row: { token: string; owner_id: string; created_at: string }
        Insert: { token: string; owner_id: string; created_at?: string }
        Update: { token?: string; owner_id?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      claim_share: { Args: { p_token: string }; Returns: { owner_id: string; owner_name: string; depth: string }[] }
      display_snapshot: { Args: { p_token: string }; Returns: Json }
      viewer_depth: { Args: { p_owner: string }; Returns: string | null }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

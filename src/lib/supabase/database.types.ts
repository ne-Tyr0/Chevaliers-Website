/**
 * Database types.
 *
 * Hand-written to match `supabase/migrations`, in the same shape the Supabase
 * CLI emits. Row types must stay type aliases rather than interfaces:
 * supabase-js constrains rows to Record<string, unknown>, and TypeScript grants
 * implicit index signatures to aliases but not to interfaces — as interfaces the
 * whole schema silently resolves to `never`.
 *
 * Once the project is live you can regenerate them instead:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type SeasonStatus = "active" | "completed";
export type RoundStatus = "pending" | "in_progress" | "completed";
export type DbPieceColor = "white" | "black";
export type DbPairingResult = "pending" | "a_win" | "b_win" | "draw";

export type PlayerRow = {
  id: string;
  full_name: string;
  pairing_number: number | null;
  /** Reserved for linking this roster entry to a future login. Null today. */
  user_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type SeasonRow = {
  id: string;
  name: string;
  status: SeasonStatus;
  created_at: string;
};

export type RoundRow = {
  id: string;
  season_id: string;
  round_number: number;
  played_on: string;
  status: RoundStatus;
  created_at: string;
};

export type RoundCheckInRow = {
  round_id: string;
  player_id: string;
  created_at: string;
};

export type PairingRow = {
  id: string;
  round_id: string;
  board_number: number;
  player_a_id: string;
  player_b_id: string | null;
  color_a: DbPieceColor | null;
  color_b: DbPieceColor | null;
  result: DbPairingResult;
  is_rematch: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      players: {
        Row: PlayerRow;
        Insert: {
          id?: string;
          full_name: string;
          pairing_number?: number | null;
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          pairing_number?: number | null;
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: SeasonRow;
        Insert: {
          id?: string;
          name: string;
          status?: SeasonStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: SeasonStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      rounds: {
        Row: RoundRow;
        Insert: {
          id?: string;
          season_id: string;
          round_number: number;
          played_on?: string;
          status?: RoundStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          round_number?: number;
          played_on?: string;
          status?: RoundStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      round_check_ins: {
        Row: RoundCheckInRow;
        Insert: {
          round_id: string;
          player_id: string;
          created_at?: string;
        };
        Update: {
          round_id?: string;
          player_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      pairings: {
        Row: PairingRow;
        Insert: {
          id?: string;
          round_id: string;
          board_number: number;
          player_a_id: string;
          player_b_id?: string | null;
          color_a?: DbPieceColor | null;
          color_b?: DbPieceColor | null;
          result?: DbPairingResult;
          is_rematch?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          board_number?: number;
          player_a_id?: string;
          player_b_id?: string | null;
          color_a?: DbPieceColor | null;
          color_b?: DbPieceColor | null;
          result?: DbPairingResult;
          is_rematch?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      season_status: SeasonStatus;
      round_status: RoundStatus;
      piece_color: DbPieceColor;
      pairing_result: DbPairingResult;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

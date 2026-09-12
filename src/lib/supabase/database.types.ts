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
export type DbPairingResult =
  | "pending"
  | "a_win"
  | "b_win"
  | "draw"
  | "a_forfeit_win"
  | "b_forfeit_win"
  | "double_forfeit";

export type PlayerRow = {
  id: string;
  full_name: string;
  /** Grade and section, e.g. "7-Diamond". Display only. */
  grade: string | null;
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
  /** False for rounds entered from paper, where nobody recorded who had White. */
  tracks_colors: boolean;
  created_at: string;
};

export type PairingRow = {
  id: string;
  round_id: string;
  board_number: number;
  player_a_id: string;
  player_b_id: string | null;
  is_rematch: boolean;
  created_at: string;
};

/** One game inside a matchup. Player B's colour is the opposite of `color_a`. */
export type GameRow = {
  id: string;
  pairing_id: string;
  game_number: number;
  color_a: DbPieceColor | null;
  result: DbPairingResult;
  updated_by: string | null;
  updated_at: string;
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
          grade?: string | null;
          pairing_number?: number | null;
          user_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          grade?: string | null;
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
          tracks_colors?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          round_number?: number;
          played_on?: string;
          status?: RoundStatus;
          tracks_colors?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rounds_season_id_fkey";
            columns: ["season_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id"];
          },
        ];
      };
      pairings: {
        Row: PairingRow;
        Insert: {
          id?: string;
          round_id: string;
          board_number: number;
          player_a_id: string;
          player_b_id?: string | null;
          is_rematch?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          round_id?: string;
          board_number?: number;
          player_a_id?: string;
          player_b_id?: string | null;
          is_rematch?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: GameRow;
        Insert: {
          id?: string;
          pairing_id: string;
          game_number: number;
          color_a?: DbPieceColor | null;
          result?: DbPairingResult;
          updated_by?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pairing_id?: string;
          game_number?: number;
          color_a?: DbPieceColor | null;
          result?: DbPairingResult;
          updated_by?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_pairing_id_fkey";
            columns: ["pairing_id"];
            isOneToOne: false;
            referencedRelation: "pairings";
            referencedColumns: ["id"];
          },
        ];
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

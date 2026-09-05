/**
 * Database types.
 *
 * Hand-written to match `supabase/migrations`, in the same shape the Supabase
 * CLI emits. Once the project is live you can regenerate them instead:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts
 */

export type MemberRole = "member" | "officer";
export type SeasonStatus = "active" | "completed";
export type RoundStatus = "pending" | "in_progress" | "completed";
export type DbPieceColor = "white" | "black";
export type DbPairingResult = "pending" | "a_win" | "b_win" | "draw";

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: MemberRole;
  pairing_number: number | null;
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
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          role?: MemberRole;
          pairing_number?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: MemberRole;
          pairing_number?: number | null;
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
      is_officer: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_member: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      member_role: MemberRole;
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

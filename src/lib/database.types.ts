export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      coach_notes: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          session_id: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          session_id?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_entries: {
        Row: {
          created_at: string
          day_number: number
          energy_pct: number
          id: string
          session_id: string
          slot_hour: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          energy_pct: number
          id?: string
          session_id: string
          slot_hour: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          energy_pct?: number
          id?: string
          session_id?: string
          slot_hour?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_notes: {
        Row: {
          day_number: number
          feel_note: string | null
          for_jen_note: string | null
          id: string
          session_id: string
          unexpected_note: string | null
          updated_at: string
        }
        Insert: {
          day_number: number
          feel_note?: string | null
          for_jen_note?: string | null
          id?: string
          session_id: string
          unexpected_note?: string | null
          updated_at?: string
        }
        Update: {
          day_number?: number
          feel_note?: string | null
          for_jen_note?: string | null
          id?: string
          session_id?: string
          unexpected_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_notes: {
        Row: {
          body: string
          id: string
          session_id: string
          slot_hour: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          session_id: string
          slot_hour: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          session_id?: string
          slot_hour?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          stripe_customer_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number | null
          client_id: string
          granted_by: string | null
          id: string
          note: string | null
          product: Database["public"]["Enums"]["purchase_product"]
          purchased_at: string
          session_id: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          client_id: string
          granted_by?: string | null
          id?: string
          note?: string | null
          product: Database["public"]["Enums"]["purchase_product"]
          purchased_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          client_id?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          product?: Database["public"]["Enums"]["purchase_product"]
          purchased_at?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          day_number: number
          id: string
          reminder_key: string
          sent_at: string
          session_id: string
        }
        Insert: {
          day_number: number
          id?: string
          reminder_key: string
          sent_at?: string
          session_id: string
        }
        Update: {
          day_number?: number
          id?: string
          reminder_key?: string
          sent_at?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_analysis: {
        Row: {
          computed_at: string
          ideal_day: Json | null
          session_id: string
          windows: Json | null
        }
        Insert: {
          computed_at?: string
          ideal_day?: Json | null
          session_id: string
          windows?: Json | null
        }
        Update: {
          computed_at?: string
          ideal_day?: Json | null
          session_id?: string
          windows?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "session_analysis_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "tracking_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_grants: {
        Row: {
          client_id: string
          created_at: string
          granted_by: string
          id: string
          note: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          granted_by: string
          id?: string
          note?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          granted_by?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_grants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          team_id: string
          token: string
          uses: number
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          team_id: string
          token: string
          uses?: number
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          team_id?: string
          token?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships: {
        Row: {
          client_id: string
          created_at: string
          id: string
          role: string
          team_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          role: string
          team_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_plans: {
        Row: {
          plan: Json
          released_at: string
          released_by: string | null
          round_id: string
          team_id: string
        }
        Insert: {
          plan: Json
          released_at?: string
          released_by?: string | null
          round_id: string
          team_id: string
        }
        Update: {
          plan?: Json
          released_at?: string
          released_by?: string | null
          round_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_plans_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_plans_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: true
            referencedRelation: "team_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_rounds: {
        Row: {
          created_at: string
          id: string
          number: number
          released_at: string | null
          released_by: string | null
          status: Database["public"]["Enums"]["team_round_status"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          number: number
          released_at?: string | null
          released_by?: string | null
          status?: Database["public"]["Enums"]["team_round_status"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: number
          released_at?: string | null
          released_by?: string | null
          status?: Database["public"]["Enums"]["team_round_status"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_rounds_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_rounds_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          company_id: string
          created_at: string
          id: string
          lead_id: string | null
          name: string
          seats: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          lead_id?: string | null
          name: string
          seats?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string | null
          name?: string
          seats?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_sessions: {
        Row: {
          client_id: string
          created_at: string
          day_count: number
          flag_cleared_at: string | null
          id: string
          label: string | null
          reminder_pref: Database["public"]["Enums"]["reminder_pref"]
          round_id: string | null
          sleep_time: string
          start_date: string
          status: Database["public"]["Enums"]["session_status"]
          timezone: string | null
          wake_time: string
        }
        Insert: {
          client_id: string
          created_at?: string
          day_count: number
          flag_cleared_at?: string | null
          id?: string
          label?: string | null
          reminder_pref?: Database["public"]["Enums"]["reminder_pref"]
          round_id?: string | null
          sleep_time: string
          start_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          timezone?: string | null
          wake_time: string
        }
        Update: {
          client_id?: string
          created_at?: string
          day_count?: number
          flag_cleared_at?: string | null
          id?: string
          label?: string | null
          reminder_pref?: Database["public"]["Enums"]["reminder_pref"]
          round_id?: string | null
          sleep_time?: string
          start_date?: string
          status?: Database["public"]["Enums"]["session_status"]
          timezone?: string | null
          wake_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_sessions_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "team_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_round: { Args: never; Returns: string }
      can_start_session: { Args: never; Returns: boolean }
      entry_hour_open: {
        Args: { p_day: number; p_session: string; p_slot: string }
        Returns: boolean
      }
      entry_window_closed: {
        Args: { p_day: number; p_session: string; p_slot: string }
        Returns: boolean
      }
      entry_window_open: {
        Args: { p_day: number; p_session: string; p_slot: string }
        Returns: boolean
      }
      has_peak_plan: { Args: { p_session: string }; Returns: boolean }
      is_coach: { Args: never; Returns: boolean }
      is_team_lead: { Args: { p_team: string }; Returns: boolean }
      is_team_member: { Args: { p_team: string }; Returns: boolean }
      join_team: { Args: { p_token: string }; Returns: string }
      set_session_flag_review: {
        Args: { p_clear: boolean; p_session: string }
        Returns: undefined
      }
      team_progress: {
        Args: { p_team: string }
        Returns: {
          client_id: string
          day_count: number
          days_complete: number
          flagged: boolean
          full_name: string
          hours_logged: number
          hours_per_day: number
          joined_at: string
          missed_hours: number
          role: string
          session_id: string
          session_status: string
        }[]
      }
    }
    Enums: {
      purchase_product: "basic_peak_plan" | "peak_plan_session" | "coaching"
      purchase_status: "pending" | "completed" | "refunded"
      reminder_pref: "none" | "hourly" | "three_times_daily" | "once_daily"
      session_status: "in_progress" | "completed"
      team_round_status: "setup" | "tracking" | "released"
      user_role: "client" | "coach" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      purchase_product: ["basic_peak_plan", "peak_plan_session", "coaching"],
      purchase_status: ["pending", "completed", "refunded"],
      reminder_pref: ["none", "hourly", "three_times_daily", "once_daily"],
      session_status: ["in_progress", "completed"],
      team_round_status: ["setup", "tracking", "released"],
      user_role: ["client", "coach", "admin"],
    },
  },
} as const

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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      loan_requests: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          disbursed_at: string | null
          disbursed_transaction_id: string | null
          due_date: string | null
          id: string
          member_id: string
          purpose: string
          repayment_months: number | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["loan_request_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          disbursed_at?: string | null
          disbursed_transaction_id?: string | null
          due_date?: string | null
          id?: string
          member_id: string
          purpose: string
          repayment_months?: number | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          disbursed_at?: string | null
          disbursed_transaction_id?: string | null
          due_date?: string | null
          id?: string
          member_id?: string
          purpose?: string
          repayment_months?: number | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["loan_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_requests_disbursed_transaction_id_fkey"
            columns: ["disbursed_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_requests_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          full_name: string
          id: string
          invited_by: string | null
          member_code: string | null
          member_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          full_name: string
          id?: string
          invited_by?: string | null
          member_code?: string | null
          member_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          member_code?: string | null
          member_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_invites_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          joined_date: string
          member_code: string
          notes: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          joined_date?: string
          member_code: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          joined_date?: string
          member_code?: string
          notes?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notices: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          link: string | null
          message: string
          priority: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          link?: string | null
          message: string
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          link?: string | null
          message?: string
          priority?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_url: string | null
          progress: number
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_url?: string | null
          progress?: number
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_url?: string | null
          progress?: number
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_schedule_settings: {
        Row: {
          created_at: string
          day_of_month: number
          enabled: boolean
          hour: number
          id: string
          last_run_at: string | null
          last_run_status: string | null
          minute: number
          singleton: boolean
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          day_of_month?: number
          enabled?: boolean
          hour?: number
          id?: string
          last_run_at?: string | null
          last_run_status?: string | null
          minute?: number
          singleton?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          day_of_month?: number
          enabled?: boolean
          hour?: number
          id?: string
          last_run_at?: string | null
          last_run_status?: string | null
          minute?: number
          singleton?: boolean
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_images: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          public_url: string
          sort_order: number
          storage_path: string
          title: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          public_url: string
          sort_order?: number
          storage_path: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          public_url?: string
          sort_order?: number
          storage_path?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          about_intro: string
          created_at: string
          email: string
          group_name: string
          id: string
          location: string
          marquee_enabled: boolean
          mission: string
          phone: string
          singleton: boolean
          tagline: string
          updated_at: string
          updated_by: string | null
          vision: string
        }
        Insert: {
          about_intro?: string
          created_at?: string
          email?: string
          group_name?: string
          id?: string
          location?: string
          marquee_enabled?: boolean
          mission?: string
          phone?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
          updated_by?: string | null
          vision?: string
        }
        Update: {
          about_intro?: string
          created_at?: string
          email?: string
          group_name?: string
          id?: string
          location?: string
          marquee_enabled?: boolean
          mission?: string
          phone?: string
          singleton?: boolean
          tagline?: string
          updated_at?: string
          updated_by?: string | null
          vision?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["txn_category"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          member_id: string
          reference: string | null
          source: string
          transaction_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["txn_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id: string
          reference?: string | null
          source?: string
          transaction_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["txn_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          member_id?: string
          reference?: string | null
          source?: string
          transaction_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_member: { Args: { p_member_id: string }; Returns: Json }
      admin_link_member_account: {
        Args: {
          p_confirm_email?: boolean
          p_member_id: string
          p_overwrite_email?: boolean
          p_role?: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: Json
      }
      admin_update_site_settings: {
        Args: {
          p_about_intro: string
          p_email: string
          p_group_name: string
          p_id: string
          p_location: string
          p_marquee_enabled: boolean
          p_mission: string
          p_phone: string
          p_tagline: string
          p_vision: string
        }
        Returns: Json
      }
      claim_member_invite: { Args: { p_token: string }; Returns: Json }
      get_member_invite: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          full_name: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      list_users_with_roles: {
        Args: never
        Returns: {
          email: string
          roles: string[]
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "treasurer"
        | "secretary"
        | "project_manager"
        | "member"
      loan_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "disbursed"
        | "cancelled"
      txn_category:
        | "monthly_contribution"
        | "account_boosting"
        | "fine"
        | "loan_disbursement"
        | "loan_repayment"
        | "shirts_loan"
        | "interest"
        | "due"
        | "penalty"
        | "other"
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
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "treasurer",
        "secretary",
        "project_manager",
        "member",
      ],
      loan_request_status: [
        "pending",
        "approved",
        "rejected",
        "disbursed",
        "cancelled",
      ],
      txn_category: [
        "monthly_contribution",
        "account_boosting",
        "fine",
        "loan_disbursement",
        "loan_repayment",
        "shirts_loan",
        "interest",
        "due",
        "penalty",
        "other",
      ],
    },
  },
} as const

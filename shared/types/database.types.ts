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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_read: boolean | null
          last_email_at: string | null
          last_email_id: string | null
          last_email_preview: string | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_read?: boolean | null
          last_email_at?: string | null
          last_email_id?: string | null
          last_email_preview?: string | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_read?: boolean | null
          last_email_at?: string | null
          last_email_id?: string | null
          last_email_preview?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_last_email_id_fkey"
            columns: ["last_email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      email_accounts: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string
          id: string
          imap_host: string
          imap_port: number
          imap_use_tls: boolean
          imap_username: string
          is_active: boolean | null
          last_sync_at: string | null
          password: string
          provider_type: string | null
          smtp_host: string | null
          smtp_port: number
          smtp_use_tls: boolean
          smtp_username: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email: string
          id?: string
          imap_host: string
          imap_port?: number
          imap_use_tls?: boolean
          imap_username: string
          is_active?: boolean | null
          last_sync_at?: string | null
          password: string
          provider_type?: string | null
          smtp_host?: string | null
          smtp_port?: number
          smtp_use_tls?: boolean
          smtp_username?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string
          id?: string
          imap_host?: string
          imap_port?: number
          imap_use_tls?: boolean
          imap_username?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          password?: string
          provider_type?: string | null
          smtp_host?: string | null
          smtp_port?: number
          smtp_use_tls?: boolean
          smtp_username?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      emails: {
        Row: {
          account_id: string | null
          cc_addresses: Json | null
          contact_id: string | null
          created_at: string | null
          date_received: string | null
          date_sent: string
          folder: string | null
          from_address: string
          from_name: string | null
          gmail_thread_id: number | null
          has_attachments: boolean | null
          id: string
          imap_uid: number
          is_deleted: boolean | null
          is_read: boolean | null
          is_starred: boolean | null
          message_id: string
          preview_text: string | null
          size_bytes: number | null
          subject: string | null
          sync_status: string | null
          to_addresses: Json | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          cc_addresses?: Json | null
          contact_id?: string | null
          created_at?: string | null
          date_received?: string | null
          date_sent: string
          folder?: string | null
          from_address: string
          from_name?: string | null
          gmail_thread_id?: number | null
          has_attachments?: boolean | null
          id?: string
          imap_uid: number
          is_deleted?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          message_id: string
          preview_text?: string | null
          size_bytes?: number | null
          subject?: string | null
          sync_status?: string | null
          to_addresses?: Json | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          cc_addresses?: Json | null
          contact_id?: string | null
          created_at?: string | null
          date_received?: string | null
          date_sent?: string
          folder?: string | null
          from_address?: string
          from_name?: string | null
          gmail_thread_id?: number | null
          has_attachments?: boolean | null
          id?: string
          imap_uid?: number
          is_deleted?: boolean | null
          is_read?: boolean | null
          is_starred?: boolean | null
          message_id?: string
          preview_text?: string | null
          size_bytes?: number | null
          subject?: string | null
          sync_status?: string | null
          to_addresses?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "email_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_sync_progress: {
        Args: { emails_processed: number; total_emails_estimated: number }
        Returns: number
      }
      create_contact: {
        Args: {
          contact_created_at: string
          contact_email: string
          contact_id: string
          contact_name: string
          contact_updated_at: string
          contact_user_id: string
        }
        Returns: undefined
      }
      epoch_to_timestamp: {
        Args: { epoch_ms: number }
        Returns: string
      }
      pull: {
        Args: { last_pulled_ms?: number; requesting_user_id: string }
        Returns: Json
      }
      push: {
        Args: { changes: Json; requesting_user_id: string }
        Returns: undefined
      }
      timestamp_to_epoch: {
        Args: { ts: string }
        Returns: number
      }
      update_sync_job_progress: {
        Args: {
          job_id: string
          new_emails_failed?: number
          new_emails_processed: number
          new_emails_skipped?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

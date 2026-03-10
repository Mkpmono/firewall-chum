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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_ips: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ddos_events: {
        Row: {
          attack_type: string
          created_at: string
          ended_at: string | null
          id: string
          ip_address: string
          notes: string | null
          packets_blocked: number | null
          packets_redirected: number | null
          severity: string
          source_ips: string[] | null
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          attack_type?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          ip_address: string
          notes?: string | null
          packets_blocked?: number | null
          packets_redirected?: number | null
          severity?: string
          source_ips?: string[] | null
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          attack_type?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          ip_address?: string
          notes?: string | null
          packets_blocked?: number | null
          packets_redirected?: number | null
          severity?: string
          source_ips?: string[] | null
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      firewall_rules: {
        Row: {
          action: string
          created_at: string
          destination_ip: string
          direction: string
          enabled: boolean
          id: string
          label: string | null
          notes: string | null
          port: number | null
          port_range: string | null
          priority: number
          protocol: string
          source_ip: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string
          created_at?: string
          destination_ip?: string
          direction?: string
          enabled?: boolean
          id?: string
          label?: string | null
          notes?: string | null
          port?: number | null
          port_range?: string | null
          priority?: number
          protocol?: string
          source_ip?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          destination_ip?: string
          direction?: string
          enabled?: boolean
          id?: string
          label?: string | null
          notes?: string | null
          port?: number | null
          port_range?: string | null
          priority?: number
          protocol?: string
          source_ip?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      geoip_rules: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          enabled: boolean
          id: string
          mode: string
          notes: string | null
          user_id: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          enabled?: boolean
          id?: string
          mode?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          enabled?: boolean
          id?: string
          mode?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ip_bans: {
        Row: {
          banned_at: string
          created_at: string
          enabled: boolean
          expires_at: string | null
          id: string
          ip_address: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_at?: string
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_at?: string
          created_at?: string
          enabled?: boolean
          expires_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      preset_template_rules: {
        Row: {
          action: string
          created_at: string
          direction: string
          id: string
          label: string
          notes: string | null
          port: number | null
          port_range: string | null
          preset_id: string
          priority: number
          protocol: string
        }
        Insert: {
          action?: string
          created_at?: string
          direction?: string
          id?: string
          label: string
          notes?: string | null
          port?: number | null
          port_range?: string | null
          preset_id: string
          priority?: number
          protocol?: string
        }
        Update: {
          action?: string
          created_at?: string
          direction?: string
          id?: string
          label?: string
          notes?: string | null
          port?: number | null
          port_range?: string | null
          preset_id?: string
          priority?: number
          protocol?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_template_rules_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "preset_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string
          id: string
          is_premium: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_premium?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_premium?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          ddos_protection: boolean
          display_name: string | null
          email: string | null
          id: string
          max_rules: number
          sinkhole_ip: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ddos_protection?: boolean
          display_name?: string | null
          email?: string | null
          id?: string
          max_rules?: number
          sinkhole_ip?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ddos_protection?: boolean
          display_name?: string | null
          email?: string | null
          id?: string
          max_rules?: number
          sinkhole_ip?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      servers: {
        Row: {
          api_key: string
          created_at: string
          hostname: string
          id: string
          label: string | null
          last_sync_at: string | null
          last_sync_status: string | null
          os_info: string | null
          panel_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          hostname: string
          id?: string
          label?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          os_info?: string | null
          panel_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          hostname?: string
          id?: string
          label?: string | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          os_info?: string | null
          panel_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      useragent_rules: {
        Row: {
          block_type: string
          created_at: string
          enabled: boolean
          id: string
          label: string | null
          notes: string | null
          pattern: string
          user_id: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          notes?: string | null
          pattern: string
          user_id: string
        }
        Update: {
          block_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          notes?: string | null
          pattern?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

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
      admin_plans: {
        Row: {
          created_at: string
          description: string | null
          duration_months: number
          id: string
          is_active: boolean
          max_clients: number
          module_banners: boolean
          module_campaigns: boolean
          module_cashflow: boolean
          module_games: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          max_clients?: number
          module_banners?: boolean
          module_campaigns?: boolean
          module_cashflow?: boolean
          module_games?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          max_clients?: number
          module_banners?: boolean
          module_campaigns?: boolean
          module_cashflow?: boolean
          module_games?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      billing_automation_config: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          notify_after_due: boolean
          notify_before_due: boolean
          notify_on_due: boolean
          send_hour: number
          send_hour_after_due: number
          send_hour_before_due: number
          send_hour_on_due: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          notify_after_due?: boolean
          notify_before_due?: boolean
          notify_on_due?: boolean
          send_hour?: number
          send_hour_after_due?: number
          send_hour_before_due?: number
          send_hour_on_due?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          notify_after_due?: boolean
          notify_before_due?: boolean
          notify_on_due?: boolean
          send_hour?: number
          send_hour_after_due?: number
          send_hour_before_due?: number
          send_hour_on_due?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_notifications_log: {
        Row: {
          client_id: string
          due_date: string
          id: string
          message_content: string | null
          notification_type: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          client_id: string
          due_date: string
          id?: string
          message_content?: string | null
          notification_type: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          client_id?: string
          due_date?: string
          id?: string
          message_content?: string | null
          notification_type?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      cash_flow_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cash_flow_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          entry_date: string
          id: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          entry_date?: string
          id?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          entry_date?: string
          id?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          due_date: string
          id: string
          name: string
          phone: string
          plan_id: string | null
          registration_date: string
          service_id: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          due_date?: string
          id?: string
          name: string
          phone: string
          plan_id?: string | null
          registration_date?: string
          service_id?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          due_date?: string
          id?: string
          name?: string
          phone?: string
          plan_id?: string | null
          registration_date?: string
          service_id?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      football_daily_cache: {
        Row: {
          cache_date: string
          channels: Json
          created_at: string
          id: string
          matches: Json
          provider: string
          updated_at: string
        }
        Insert: {
          cache_date?: string
          channels?: Json
          created_at?: string
          id?: string
          matches?: Json
          provider?: string
          updated_at?: string
        }
        Update: {
          cache_date?: string
          channels?: Json
          created_at?: string
          id?: string
          matches?: Json
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      football_user_config: {
        Row: {
          accent_color: string | null
          background_url: string | null
          created_at: string
          custom_title: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          accent_color?: string | null
          background_url?: string | null
          created_at?: string
          custom_title?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          accent_color?: string | null
          background_url?: string | null
          created_at?: string
          custom_title?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_recurring: boolean
          payment_date: string | null
          payment_method: string | null
          plan_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_recurring?: boolean
          payment_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_recurring?: boolean
          payment_date?: string | null
          payment_method?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_client_lines: {
        Row: {
          bouquet_ids: Json
          client_id: string
          created_at: string
          enabled: boolean
          exp_date: string | null
          id: string
          is_trial: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          max_connections: number
          server_id: string
          updated_at: string
          user_id: string
          xui_password: string
          xui_user_id: number | null
          xui_username: string
        }
        Insert: {
          bouquet_ids?: Json
          client_id: string
          created_at?: string
          enabled?: boolean
          exp_date?: string | null
          id?: string
          is_trial?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          max_connections?: number
          server_id: string
          updated_at?: string
          user_id: string
          xui_password: string
          xui_user_id?: number | null
          xui_username: string
        }
        Update: {
          bouquet_ids?: Json
          client_id?: string
          created_at?: string
          enabled?: boolean
          exp_date?: string | null
          id?: string
          is_trial?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          max_connections?: number
          server_id?: string
          updated_at?: string
          user_id?: string
          xui_password?: string
          xui_user_id?: number | null
          xui_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "iptv_client_lines_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "iptv_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_servers: {
        Row: {
          admin_id: number
          created_at: string
          db_name: string
          db_password_encrypted: string
          db_user: string
          host: string
          id: string
          is_active: boolean
          last_test_at: string | null
          last_test_message: string | null
          last_test_ok: boolean | null
          name: string
          port: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: number
          created_at?: string
          db_name?: string
          db_password_encrypted: string
          db_user: string
          host: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          name: string
          port?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: number
          created_at?: string
          db_name?: string
          db_password_encrypted?: string
          db_user?: string
          host?: string
          id?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_message?: string | null
          last_test_ok?: boolean | null
          name?: string
          port?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      iptv_sync_logs: {
        Row: {
          action: string
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          server_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          server_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          server_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          api_response: string | null
          client_id: string | null
          id: string
          message_content: string
          sent_at: string
          status: string
          template_type: string
          user_id: string
        }
        Insert: {
          api_response?: string | null
          client_id?: string | null
          id?: string
          message_content: string
          sent_at?: string
          status: string
          template_type: string
          user_id: string
        }
        Update: {
          api_response?: string | null
          client_id?: string | null
          id?: string
          message_content?: string
          sent_at?: string
          status?: string
          template_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          type: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_gateway_config: {
        Row: {
          access_token: string
          created_at: string
          id: string
          is_enabled: boolean
          pix_key: string | null
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          pix_key?: string | null
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          pix_key?: string | null
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          description: string
          expires_at: string | null
          id: string
          mp_payment_id: string | null
          pix_copy_paste: string | null
          qr_code_base64: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          mp_payment_id?: string | null
          pix_copy_paste?: string | null
          qr_code_base64?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          id?: string
          mp_payment_id?: string | null
          pix_copy_paste?: string | null
          qr_code_base64?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          duration_months: number
          id: string
          name: string
          price: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_months?: number
          id?: string
          name: string
          price?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_months?: number
          id?: string
          name?: string
          price?: number | null
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          accent_color: string
          email_verification_enabled: boolean
          favicon_url: string | null
          football_accent_color: string | null
          football_api_key: string | null
          football_api_key_secondary: string | null
          football_api_key_tertiary: string | null
          football_api_provider: string | null
          football_apifootball_leagues: Json | null
          football_apisport_leagues: Json | null
          football_banners_enabled: boolean | null
          football_date_format: string | null
          football_default_font: string | null
          football_default_logo_url: string | null
          football_footballdata_leagues: Json | null
          football_primary_color: string | null
          football_secondary_color: string | null
          football_timezone: string | null
          id: string
          landing_dark_mode: boolean
          login_bg_url: string | null
          logo_url: string | null
          primary_color: string
          secondary_color: string
          system_name: string
          tmdb_api_key: string
          updated_at: string
          whatsapp_verification_enabled: boolean
        }
        Insert: {
          accent_color?: string
          email_verification_enabled?: boolean
          favicon_url?: string | null
          football_accent_color?: string | null
          football_api_key?: string | null
          football_api_key_secondary?: string | null
          football_api_key_tertiary?: string | null
          football_api_provider?: string | null
          football_apifootball_leagues?: Json | null
          football_apisport_leagues?: Json | null
          football_banners_enabled?: boolean | null
          football_date_format?: string | null
          football_default_font?: string | null
          football_default_logo_url?: string | null
          football_footballdata_leagues?: Json | null
          football_primary_color?: string | null
          football_secondary_color?: string | null
          football_timezone?: string | null
          id?: string
          landing_dark_mode?: boolean
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          system_name?: string
          tmdb_api_key?: string
          updated_at?: string
          whatsapp_verification_enabled?: boolean
        }
        Update: {
          accent_color?: string
          email_verification_enabled?: boolean
          favicon_url?: string | null
          football_accent_color?: string | null
          football_api_key?: string | null
          football_api_key_secondary?: string | null
          football_api_key_tertiary?: string | null
          football_api_provider?: string | null
          football_apifootball_leagues?: Json | null
          football_apisport_leagues?: Json | null
          football_banners_enabled?: boolean | null
          football_date_format?: string | null
          football_default_font?: string | null
          football_default_logo_url?: string | null
          football_footballdata_leagues?: Json | null
          football_primary_color?: string | null
          football_secondary_color?: string | null
          football_timezone?: string | null
          id?: string
          landing_dark_mode?: boolean
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          system_name?: string
          tmdb_api_key?: string
          updated_at?: string
          whatsapp_verification_enabled?: boolean
        }
        Relationships: []
      }
      player_image_cache: {
        Row: {
          created_at: string
          generated_date: string
          id: string
          image_url: string
          team_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          generated_date?: string
          id?: string
          image_url: string
          team_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          generated_date?: string
          id?: string
          image_url?: string
          team_name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_plan_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          plan_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_plan_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          plan_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_plan_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          plan_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_admin_plan_id_fkey"
            columns: ["admin_plan_id"]
            isOneToOne: false
            referencedRelation: "admin_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      support_materials: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tmdb_config: {
        Row: {
          api_key: string
          created_at: string
          id: string
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutorials: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          sort_order: number
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          instance_name: string
          is_connected: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          instance_name: string
          is_connected?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          is_connected?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_global_config: {
        Row: {
          api_key: string
          api_url: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_platform_instance: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          is_connected: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          is_connected?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          is_connected?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_verifications: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          password_hash: string
          phone: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          password_hash: string
          phone: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          password_hash?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      whmcs_global_config: {
        Row: {
          api_identifier: string
          api_secret: string
          api_url: string
          created_at: string
          id: string
          is_enabled: boolean
          updated_at: string
        }
        Insert: {
          api_identifier?: string
          api_secret?: string
          api_url?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Update: {
          api_identifier?: string
          api_secret?: string
          api_url?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      platform_settings_public: {
        Row: {
          accent_color: string | null
          email_verification_enabled: boolean | null
          favicon_url: string | null
          football_banners_enabled: boolean | null
          id: string | null
          landing_dark_mode: boolean | null
          login_bg_url: string | null
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          system_name: string | null
          whatsapp_verification_enabled: boolean | null
        }
        Insert: {
          accent_color?: string | null
          email_verification_enabled?: boolean | null
          favicon_url?: string | null
          football_banners_enabled?: boolean | null
          id?: string | null
          landing_dark_mode?: boolean | null
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          system_name?: string | null
          whatsapp_verification_enabled?: boolean | null
        }
        Update: {
          accent_color?: string | null
          email_verification_enabled?: boolean | null
          favicon_url?: string | null
          football_banners_enabled?: boolean | null
          id?: string | null
          landing_dark_mode?: boolean | null
          login_bg_url?: string | null
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          system_name?: string | null
          whatsapp_verification_enabled?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      iptv_decrypt_password: {
        Args: { _cipher: string; _key: string }
        Returns: string
      }
      iptv_encrypt_password: {
        Args: { _key: string; _plain: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
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

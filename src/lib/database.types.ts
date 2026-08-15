export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          amount_paid: number;
          created_at: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          employee_id: string | null;
          end_time: string;
          id: string;
          is_blocked: boolean | null;
          notes: string | null;
          organization_id: string | null;
          payment_method: string | null;
          payment_status: string;
          promotion_id: string | null;
          reminder_sent_at: string | null;
          service_id: string | null;
          start_time: string;
          status: string;
        };
        Insert: {
          amount_paid?: number;
          created_at?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          employee_id?: string | null;
          end_time: string;
          id?: string;
          is_blocked?: boolean | null;
          notes?: string | null;
          organization_id?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          promotion_id?: string | null;
          reminder_sent_at?: string | null;
          service_id?: string | null;
          start_time: string;
          status?: string;
        };
        Update: {
          amount_paid?: number;
          created_at?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          employee_id?: string | null;
          end_time?: string;
          id?: string;
          is_blocked?: boolean | null;
          notes?: string | null;
          organization_id?: string | null;
          payment_method?: string | null;
          payment_status?: string;
          promotion_id?: string | null;
          reminder_sent_at?: string | null;
          service_id?: string | null;
          start_time?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          new_data: Json | null;
          old_data: Json | null;
          organization_id: string | null;
          record_id: string | null;
          table_name: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          record_id?: string | null;
          table_name: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          organization_id?: string | null;
          record_id?: string | null;
          table_name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          company_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          organization_id: string;
          phone: string;
          phone_normalized: string | null;
          updated_at: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          phone: string;
          phone_normalized?: string | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          phone?: string;
          phone_normalized?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_business_hours: {
        Row: {
          day_of_week: number;
          end_time: string;
          is_active: boolean;
          organization_id: string;
          start_time: string;
        };
        Insert: {
          day_of_week: number;
          end_time: string;
          is_active?: boolean;
          organization_id: string;
          start_time: string;
        };
        Update: {
          day_of_week?: number;
          end_time?: string;
          is_active?: boolean;
          organization_id?: string;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_business_hours_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_settings: {
        Row: {
          address: Json;
          bio: string;
          instagram: string;
          organization_id: string;
          specialty: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: Json;
          bio?: string;
          instagram?: string;
          organization_id: string;
          specialty?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: Json;
          bio?: string;
          instagram?: string;
          organization_id?: string;
          specialty?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          accent_color: string | null;
          created_at: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          onboarding_completed_at: string | null;
          owner_id: string | null;
          plan_name: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          slug: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          trial_end: string | null;
          updated_at: string | null;
        };
        Insert: {
          accent_color?: string | null;
          created_at?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          onboarding_completed_at?: string | null;
          owner_id?: string | null;
          plan_name?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_end?: string | null;
          updated_at?: string | null;
        };
        Update: {
          accent_color?: string | null;
          created_at?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          onboarding_completed_at?: string | null;
          owner_id?: string | null;
          plan_name?: string | null;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_end?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      password_reset_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          token: string;
          used: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          token: string;
          used?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          token?: string;
          used?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      portal_otp_challenges: {
        Row: {
          attempts: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          customer_id: string;
          expires_at: string;
          id: string;
          ip_hash: string;
          organization_id: string;
          phone_hash: string;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          customer_id: string;
          expires_at: string;
          id?: string;
          ip_hash: string;
          organization_id: string;
          phone_hash: string;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          expires_at?: string;
          id?: string;
          ip_hash?: string;
          organization_id?: string;
          phone_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_otp_challenges_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_otp_challenges_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_otp_requests: {
        Row: {
          created_at: string;
          id: string;
          ip_hash: string;
          phone_hash: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ip_hash: string;
          phone_hash: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          ip_hash?: string;
          phone_hash?: string;
        };
        Relationships: [];
      };
      portal_sessions: {
        Row: {
          created_at: string;
          customer_id: string;
          expires_at: string;
          id: string;
          last_seen_at: string;
          organization_id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          expires_at: string;
          id?: string;
          last_seen_at?: string;
          organization_id: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          expires_at?: string;
          id?: string;
          last_seen_at?: string;
          organization_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portal_sessions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_sessions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string | null;
          email: string | null;
          full_name: string;
          id: string;
          organization_id: string | null;
          phone: string | null;
          photo_url: string | null;
          role: string;
          updated_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name: string;
          id: string;
          organization_id?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          role: string;
          updated_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          organization_id?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          role?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      promotions: {
        Row: {
          active: boolean;
          created_at: string;
          description: string | null;
          discount_type: string;
          discount_value: number;
          end_date: string | null;
          id: string;
          name: string;
          organization_id: string;
          service_id: string | null;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          discount_type?: string;
          discount_value: number;
          end_date?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          service_id?: string | null;
          start_date?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          description?: string | null;
          discount_type?: string;
          discount_value?: number;
          end_date?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          service_id?: string | null;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          appointment_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          rating: number;
          updated_at: string;
        };
        Insert: {
          appointment_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          rating: number;
          updated_at?: string;
        };
        Update: {
          appointment_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          rating?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: true;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      services: {
        Row: {
          category: string | null;
          created_at: string | null;
          description: string | null;
          duration_minutes: number;
          id: string;
          is_active: boolean | null;
          name: string;
          organization_id: string | null;
          price: number;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean | null;
          name: string;
          organization_id?: string | null;
          price: number;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          description?: string | null;
          duration_minutes?: number;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          organization_id?: string | null;
          price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_codes: {
        Row: {
          code: string;
          created_at: string | null;
          expires_at: string;
          id: string;
          phone: string;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          expires_at: string;
          id?: string;
          phone: string;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          expires_at?: string;
          id?: string;
          phone?: string;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          created_at: string;
          customer_id: string;
          desired_date: string;
          employee_id: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          service_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          desired_date: string;
          employee_id?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          service_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          desired_date?: string;
          employee_id?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          service_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_events: {
        Row: {
          event_type: string;
          id: string;
          processed_at: string;
          provider: string;
          provider_event_id: string;
        };
        Insert: {
          event_type: string;
          id?: string;
          processed_at?: string;
          provider: string;
          provider_event_id: string;
        };
        Update: {
          event_type?: string;
          id?: string;
          processed_at?: string;
          provider?: string;
          provider_event_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_availability: {
        Args: {
          p_employee_id?: string;
          p_end_time: string;
          p_exclude_appointment_id?: string;
          p_organization_id: string;
          p_start_time: string;
        };
        Returns: boolean;
      };
      complete_onboarding: {
        Args: { p_payload: Json; p_user_id: string };
        Returns: string;
      };
      complete_password_reset: {
        Args: { new_password: string; reset_token: string };
        Returns: Json;
      };
      get_customer_appointments: {
        Args: { p_customer_id: string };
        Returns: {
          end_time: string;
          id: string;
          service_duration: number;
          service_name: string;
          service_price: number;
          start_time: string;
          status: string;
        }[];
      };
      get_dashboard_stats: {
        Args: { organization_id: string };
        Returns: {
          avg_ticket: number;
          total_appointments: number;
          total_customers: number;
          total_revenue: number;
        }[];
      };
      get_monthly_revenue: {
        Args: { organization_id: string };
        Returns: {
          month: string;
          revenue: number;
        }[];
      };
      get_peak_hours: {
        Args: { organization_id: string };
        Returns: {
          appointments: number;
          hour: string;
        }[];
      };
      get_top_services: {
        Args: { organization_id: string };
        Returns: {
          count: number;
          revenue: number;
          service_name: string;
        }[];
      };
      get_user_organization_id: { Args: never; Returns: string };
      request_otp: { Args: { phone_number: string }; Returns: Json };
      request_password_reset: { Args: { user_email: string }; Returns: Json };
      verify_otp: {
        Args: { input_code: string; phone_number: string };
        Returns: Json;
      };
      verify_reset_token: { Args: { reset_token: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

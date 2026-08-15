/**
 * Contratos tipados do schema público consumido pelo frontend.
 *
 * Este arquivo deve ser regenerado a partir do projeto Supabase após a aplicação
 * das migrations canônicas. Enquanto isso, ele evita que operações críticas
 * degradem para `never` e mantém o contrato explícito no cliente.
 *
 * @author André Narcizo - andre.narcizo@sysout.com.br
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'employee' | 'owner' | 'staff';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

type Row<T> = T & Record<string, unknown>;
type Insert<T> = Partial<T> & Record<string, unknown>;
type Update<T> = Partial<T> & Record<string, unknown>;

interface ProfileRow {
  id: string;
  organization_id: string | null;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  logo_url: string | null;
  created_at: string;
}

interface CustomerRow {
  id: string;
  organization_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

interface ServiceRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  price: number;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  organization_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  service_id: string | null;
  employee_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  notes: string | null;
  payment_status: PaymentStatus | null;
  payment_method: 'credit_card' | 'debit_card' | 'pix' | 'cash' | 'online' | null;
  amount_paid: number | null;
  is_blocked: boolean | null;
  reminder_sent_at: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Row<ProfileRow>;
        Insert: Insert<ProfileRow> & Pick<ProfileRow, 'id'>;
        Update: Update<ProfileRow>;
        Relationships: [];
      };
      organizations: {
        Row: Row<OrganizationRow>;
        Insert: Insert<OrganizationRow> & Pick<OrganizationRow, 'name'>;
        Update: Update<OrganizationRow>;
        Relationships: [];
      };
      customers: {
        Row: Row<CustomerRow>;
        Insert: Insert<CustomerRow> & Pick<CustomerRow, 'organization_id' | 'name'>;
        Update: Update<CustomerRow>;
        Relationships: [];
      };
      services: {
        Row: Row<ServiceRow>;
        Insert: Insert<ServiceRow> & Pick<ServiceRow, 'organization_id' | 'name'>;
        Update: Update<ServiceRow>;
        Relationships: [];
      };
      appointments: {
        Row: Row<AppointmentRow>;
        Insert: Insert<AppointmentRow> & Pick<AppointmentRow, 'organization_id' | 'customer_name' | 'start_time' | 'end_time'>;
        Update: Update<AppointmentRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      request_otp: {
        Args: { phone_number: string };
        Returns: { success: boolean; message: string };
      };
      verify_otp: {
        Args: { phone_number: string; input_code: string };
        Returns: {
          success: boolean;
          message?: string;
          customer?: { id: string; name: string; organization_id: string };
        };
      };
      check_availability: {
        Args: { p_start_time: string; p_end_time: string; p_organization_id: string };
        Returns: boolean;
      };
      get_customer_appointments: {
        Args: { p_customer_id: string };
        Returns: Array<{
          id: string;
          start_time: string;
          end_time: string;
          status: AppointmentStatus;
          service_name: string;
          service_price: number;
          service_duration: number;
        }>;
      };
      get_monthly_revenue: {
        Args: { organization_id: string };
        Returns: Array<{ month: string; revenue: number }>;
      };
      get_top_services: {
        Args: { organization_id: string };
        Returns: Array<{ service_name: string; count: number; revenue: number }>;
      };
      get_peak_hours: {
        Args: { organization_id: string };
        Returns: Array<{ hour: string; appointments: number }>;
      };
      get_dashboard_stats: {
        Args: { organization_id: string };
        Returns: Array<{
          total_appointments: number;
          total_customers: number;
          total_revenue: number;
          avg_ticket: number;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Modelos tipados compartilhados entre a SPA e a API Laravel. */

export type Role = 'owner' | 'admin' | 'employee';

export type SubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace'
  | 'suspended'
  | 'canceled';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface Membership {
  organization_id: string;
  role: Role;
  organization: { id: string; name: string; slug: string } | null;
}

export interface Plan {
  code: string;
  name: string;
  subtitle: string | null;
  price_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
  entitlements: Record<string, number | boolean | null>;
}

export interface SubscriptionSummary {
  status: SubscriptionStatus;
  grants_paid_access: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan: { code: string; name: string; price_cents: number } | null;
}

export interface SubscriptionUsage {
  professionals_limit: number | null;
  monthly_appointments_limit: number | null;
  monthly_appointments_used: number;
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Service {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number;
  price_cents: number;
  is_active: boolean;
}

export interface Professional {
  id: string;
  name: string;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  service_id: string | null;
  professional_id: string | null;
  customer_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  booking_source: string;
}

export interface BusinessHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface OrganizationState {
  id: string;
  name: string;
  slug: string;
  onboarding_completed: boolean;
  business_hours: BusinessHour[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

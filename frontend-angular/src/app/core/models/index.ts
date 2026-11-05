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

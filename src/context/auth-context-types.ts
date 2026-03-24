import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type UserRole = 'admin' | 'employee' | 'owner' | 'staff';

export type Profile = {
  id: string;
  organization_id: string | null;
  role: UserRole;
  full_name: string | null;
  created_at: string;
};

export type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

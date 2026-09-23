import { createContext } from "react";
import type { User } from "../types/observation";

export interface AuthState {
  user: User | null;
  token: string | null;
  /** True until the saved session has been checked on startup. */
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string, displayName: string): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
  /** Re-reads the user from the server, e.g. after verifying the email. */
  refreshUser(): Promise<void>;
  resendVerification(): Promise<void>;
  /** Sets a new password from an emailed reset link and logs in. */
  resetPassword(token: string, password: string): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { AppRole } from "./types";

interface AuthContextValue {
  session: Session | null;
  role: AppRole | null;
  clientId: string | null;
  isClientUser: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchRole(userId: string): Promise<AppRole | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  return (data?.role as AppRole | undefined) ?? null;
}

async function fetchClientId(userId: string): Promise<string | null> {
  const { data } = await supabase.from("client_users").select("client_id").eq("user_id", userId).maybeSingle();
  return data?.client_id ?? null;
}

async function loadIdentity(userId: string): Promise<{ role: AppRole | null; clientId: string | null }> {
  const [role, clientId] = await Promise.all([fetchRole(userId), fetchClientId(userId)]);
  return { role, clientId };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const identity = await loadIdentity(data.session.user.id);
        setRole(identity.role);
        setClientId(identity.clientId);
      } else {
        setRole(null);
        setClientId(null);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setLoading(true);
        loadIdentity(newSession.user.id).then((identity) => {
          setRole(identity.role);
          setClientId(identity.clientId);
          setLoading(false);
        });
      } else {
        setRole(null);
        setClientId(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isClientUser = Boolean(clientId) && !role;

  return (
    <AuthContext.Provider value={{ session, role, clientId, isClientUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

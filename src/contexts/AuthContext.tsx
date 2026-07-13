import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, missingEnvVars, supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profiles.service';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id ?? null;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Restore the persisted session, then track auth changes.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted.current) setSession(data.session);
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted.current) setSession(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    try {
      const data = await getProfile(id);
      if (mounted.current) setProfile(data);
    } catch {
      if (mounted.current) setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAdmin: profile?.role === 'admin' && profile.active,
      signIn: async (email, password) => {
        if (!supabase) throw new Error(`Falta configurar: ${missingEnvVars.join(', ')}`);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw new Error(
            error.message === 'Invalid login credentials'
              ? 'Correo o contraseña incorrectos.'
              : error.message,
          );
        }
      },
      signOut: async () => {
        await supabase?.auth.signOut();
        setProfile(null);
      },
      requestPasswordReset: async (email) => {
        if (!supabase) throw new Error(`Falta configurar: ${missingEnvVars.join(', ')}`);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/cambiar-contrasena`,
        });
        if (error) throw new Error(error.message);
      },
      changePassword: async (newPassword) => {
        if (!supabase) throw new Error(`Falta configurar: ${missingEnvVars.join(', ')}`);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
      },
      refreshProfile: async () => {
        if (userId) await loadProfile(userId);
      },
    }),
    [session, profile, loading, userId, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export { isSupabaseConfigured, missingEnvVars };

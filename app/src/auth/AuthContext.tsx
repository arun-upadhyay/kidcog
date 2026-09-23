import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Provider, Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type AuthValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (provider: Extract<Provider, 'google' | 'apple'>) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  resendVerification: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return; }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || Platform.OS === 'web') return;

    async function finishEmailVerification(url: string | null) {
      if (!url) return;
      const parsed = Linking.parse(url);
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.warn('Could not finish email verification:', error.message);
    }

    void Linking.getInitialURL().then(finishEmailVerification);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void finishEmailVerification(url);
    });
    return () => subscription.remove();
  }, []);

  async function signIn(provider: Extract<Provider, 'google' | 'apple'>) {
    if (!supabaseConfigured) throw new Error('Add the Supabase public settings to app/.env first.');
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' },
    });
    if (error) throw error;
    if (Platform.OS === 'web' || !data.url) return;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return;
    const parsed = Linking.parse(result.url);
    const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
    if (!code) throw new Error('The sign-in provider did not return an authorization code.');
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) throw exchanged.error;
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabaseConfigured) throw new Error('Add the Supabase public settings to app/.env first.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabaseConfigured) throw new Error('Add the Supabase public settings to app/.env first.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: Linking.createURL('auth/callback') },
    });
    if (error) throw error;
    return { needsVerification: !data.session };
  }

  async function resendVerification(email: string) {
    if (!supabaseConfigured) throw new Error('Add the Supabase public settings to app/.env first.');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: Linking.createURL('auth/callback') },
    });
    if (error) throw error;
  }

  const value = useMemo<AuthValue>(() => ({
    session, loading, configured: supabaseConfigured, signIn,
    signInWithEmail,
    signUpWithEmail,
    resendVerification,
    signOut: async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

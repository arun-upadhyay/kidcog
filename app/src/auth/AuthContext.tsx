import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Provider, Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { saveAppleAuthorizationCode } from '../api';

WebBrowser.maybeCompleteAuthSession();

type AuthValue = {
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn: (provider: Extract<Provider, 'google' | 'apple'>) => Promise<void>;
  /** Native Apple sheet on iPhone; browser sign-in elsewhere. Resolves quietly if the parent cancels. */
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<{ needsVerification: boolean }>;
  resendVerification: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
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

  /**
   * Sign in with Apple. On iPhone this uses Apple's own sign-in sheet (Apple
   * and Supabase both recommend the native flow there); on Android and web it
   * falls back to the browser flow used for Google.
   *
   * Only the email scope is requested: the app never shows a parent's name, so
   * there is no reason to collect it.
   */
  async function signInWithApple() {
    if (!supabaseConfigured) throw new Error('Add the Supabase public settings to app/.env first.');
    const native = Platform.OS === 'ios' && await AppleAuthentication.isAvailableAsync().catch(() => false);
    if (!native) { await signIn('apple'); return; }

    // Apple receives the SHA-256 of the nonce, Supabase the raw value, so a
    // stolen identity token cannot be replayed.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
    } catch (err) {
      // The parent closed Apple's sheet: not an error worth showing.
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      throw err;
    }
    if (!credential.identityToken) throw new Error('Apple did not return a sign-in token. Please try again.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error) throw error;

    // Lets the server revoke the Apple link if the account is ever deleted.
    // Never block sign-in on it.
    if (credential.authorizationCode) {
      void saveAppleAuthorizationCode(credential.authorizationCode).catch(err => {
        console.warn('Could not store the Apple sign-in token:', err instanceof Error ? err.message : err);
      });
    }
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

  async function updatePassword(password: string) {
    if (!supabaseConfigured) throw new Error('Add the Supabase public settings to app/.env first.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  const value = useMemo<AuthValue>(() => ({
    session, loading, configured: supabaseConfigured, signIn, signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    resendVerification,
    updatePassword,
    signOut: async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; },
  }), [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

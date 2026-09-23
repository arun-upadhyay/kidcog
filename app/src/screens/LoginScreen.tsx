import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Button from '../components/Button';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, type } from '../theme';

export default function LoginScreen() {
  const { loading, configured, signIn, signInWithEmail, signUpWithEmail, resendVerification } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'create'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'email' | 'resend' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function showError(err: unknown) {
    const message = err instanceof Error ? err.message : 'Sign-in failed.';
    if (/email not confirmed/i.test(message)) {
      setVerificationEmail(email.trim().toLowerCase());
      setError('Please verify your email before signing in.');
    } else if (/invalid login credentials/i.test(message)) {
      setError('That email or password does not match. Please try again.');
    } else {
      setError(message);
    }
  }

  async function startGoogle() {
    setBusy('google'); setError(null); setNotice(null);
    try { await signIn('google'); }
    catch (err) { showError(err); }
    finally { setBusy(null); }
  }

  async function submitEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    setError(null); setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    setBusy('email');
    try {
      if (mode === 'signIn') {
        await signInWithEmail(normalizedEmail, password);
      } else {
        const result = await signUpWithEmail(normalizedEmail, password);
        if (result.needsVerification) {
          setVerificationEmail(normalizedEmail);
          setPassword('');
        }
      }
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (!verificationEmail) return;
    setBusy('resend'); setError(null); setNotice(null);
    try {
      await resendVerification(verificationEmail);
      setNotice('A new verification email is on its way.');
    } catch (err) {
      showError(err);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.mascot}>🦉</Text>
          <Text style={styles.title}>Welcome to KidCog</Text>
          <Text style={styles.body}>Sign in as a parent to keep child nicknames and assessment sessions together.</Text>

          {!configured ? <Text style={styles.error}>Supabase is not configured. Copy app/.env.example to app/.env and add your project URL and public key.</Text> : null}

          {verificationEmail ? (
            <View style={styles.verifyCard}>
              <Text style={styles.verifyIcon}>✉️</Text>
              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.cardBody}>We sent a verification link to {verificationEmail}. Tap it, then come back and sign in.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <Button title={busy === 'resend' ? 'Sending…' : 'Send the email again'} variant="secondary" onPress={() => void resend()} disabled={busy !== null} loading={busy === 'resend'} />
              <Pressable onPress={() => { setVerificationEmail(null); setMode('signIn'); setError(null); setNotice(null); }} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Back to sign in</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.tabs}>
                <Pressable onPress={() => { setMode('signIn'); setError(null); }} style={[styles.tab, mode === 'signIn' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: mode === 'signIn' }}>
                  <Text style={[styles.tabText, mode === 'signIn' && styles.tabTextActive]}>Sign in</Text>
                </Pressable>
                <Pressable onPress={() => { setMode('create'); setError(null); }} style={[styles.tab, mode === 'create' && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: mode === 'create' }}>
                  <Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Create account</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="parent@example.com"
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
              />
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'create' ? 'At least 8 characters' : 'Your password'}
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                textContentType={mode === 'create' ? 'newPassword' : 'password'}
                secureTextEntry
                onSubmitEditing={() => void submitEmail()}
                style={styles.input}
              />
              {mode === 'create' ? <Text style={styles.helper}>We’ll email you a link to verify this parent account.</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                title={busy === 'email' ? (mode === 'create' ? 'Creating account…' : 'Signing in…') : (mode === 'create' ? 'Create parent account' : 'Sign in with email')}
                onPress={() => void submitEmail()}
                disabled={!configured || busy !== null}
                loading={busy === 'email'}
              />

              <View style={styles.divider}><View style={styles.rule} /><Text style={styles.or}>OR</Text><View style={styles.rule} /></View>
              <Button title={busy === 'google' ? 'Opening Google…' : 'Continue with Google'} variant="secondary" onPress={() => void startGoogle()} disabled={!configured || busy !== null} loading={busy === 'google'} />
            </>
          )}
          <Text style={[type.soft, styles.note]}>This account belongs to the parent or guardian. Children do not sign in.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing(3) },
  container: { padding: spacing(4), maxWidth: 560, width: '100%', alignSelf: 'center' },
  mascot: { fontSize: 54, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: colors.primary, marginTop: spacing(1) },
  body: { ...type.body, textAlign: 'center', marginTop: spacing(2), marginBottom: spacing(3) },
  tabs: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: 14, padding: 4, marginBottom: spacing(3) },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: colors.surface },
  tabText: { fontSize: 15, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: colors.primary },
  label: { ...type.label, marginBottom: spacing(1) },
  input: { minHeight: 54, borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.surface, color: colors.ink, fontSize: 17, paddingHorizontal: spacing(2), marginBottom: spacing(2) },
  helper: { ...type.soft, marginTop: -spacing(1), marginBottom: spacing(2) },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  notice: { color: colors.accent, backgroundColor: colors.accentSoft, padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing(3) },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { ...type.label, marginHorizontal: spacing(2) },
  verifyCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1.5, borderRadius: 20, padding: spacing(3) },
  verifyIcon: { fontSize: 42, textAlign: 'center', marginBottom: spacing(1) },
  cardTitle: { ...type.heading, textAlign: 'center', marginBottom: spacing(1) },
  cardBody: { ...type.body, textAlign: 'center', marginBottom: spacing(3) },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1) },
  textButtonLabel: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  note: { textAlign: 'center', marginTop: spacing(3) },
});

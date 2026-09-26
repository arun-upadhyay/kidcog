import React, { useEffect, useState } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import Button from '../components/Button';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, type } from '../theme';

export default function LoginScreen() {
  const { loading, configured, signIn, signInWithApple, signInWithEmail, signUpWithEmail, resendVerification } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'create'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'google' | 'apple' | 'email' | 'resend' | null>(null);
  // Apple's own button on iPhone. On Android and web, Apple sign-in needs an
  // Apple "Services ID" set up in Supabase first, so it is shown only once
  // EXPO_PUBLIC_APPLE_SIGNIN_WEB=1 says that has been done.
  const [appleNative, setAppleNative] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleNative).catch(() => setAppleNative(false));
  }, []);
  const showApple = Platform.OS === 'ios' ? appleNative : process.env.EXPO_PUBLIC_APPLE_SIGNIN_WEB === '1';
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function showError(err: unknown) {
    const message = err instanceof Error ? err.message : 'Sign-in failed.';
    if (/email not confirmed/i.test(message)) {
      setVerificationEmail(email.trim().toLowerCase());
      setError('Please verify your email before signing in.');
    } else if (/user is banned|banned/i.test(message)) {
      // Deleted accounts are blocked from signing in during the 30-day grace period.
      setError('This account was deleted. It will be permanently erased 30 days after deletion. To restore it before then, contact the KidCog team.');
    } else if (/invalid login credentials/i.test(message)) {
      setError('That email or password does not match. If you previously used Google, continue with Google. Otherwise, create an email account first.');
    } else {
      setError(message);
    }
  }

  async function startApple() {
    setBusy('apple'); setError(null); setNotice(null);
    try { await signInWithApple(); }
    catch (err) { showError(err); }
    finally { setBusy(null); }
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
              {mode === 'signIn' ? (
                <Text style={styles.signInHint}>{showApple ? 'Used Apple or Google before? Continue with them below. They' : 'Used Google before? Continue with Google below. It'} {showApple ? 'do' : 'does'} not automatically have a KidCog password.</Text>
              ) : null}

              <View style={styles.divider}><View style={styles.rule} /><Text style={styles.or}>OR</Text><View style={styles.rule} /></View>
              {showApple ? (
                Platform.OS === 'ios' ? (
                  // Apple's own button, as its design guidelines require on iOS.
                  <View style={[styles.appleWrap, (!configured || busy !== null) && styles.appleBusy]} pointerEvents={!configured || busy !== null ? 'none' : 'auto'}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={14}
                      style={styles.appleButton}
                      onPress={() => void startApple()}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void startApple()}
                    disabled={!configured || busy !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Continue with Apple"
                    style={({ pressed }) => [styles.appleWeb, (!configured || busy !== null) && styles.appleBusy, pressed && { opacity: 0.85 }]}
                  >
                    {busy === 'apple' ? <ActivityIndicator color="#FFFFFF" style={{ marginRight: spacing(1) }} /> : null}
                    <Text style={styles.appleWebText}>{busy === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}</Text>
                  </Pressable>
                )
              ) : null}
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
  signInHint: { ...type.soft, textAlign: 'center', marginTop: spacing(2) },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  notice: { color: colors.accent, backgroundColor: colors.accentSoft, padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing(3) },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { ...type.label, marginHorizontal: spacing(2) },
  // Same height as the other buttons, so Apple is at least as prominent as Google (App Review 4.8).
  appleWrap: { marginBottom: spacing(1.5) },
  appleButton: { width: '100%', height: 52 },
  appleBusy: { opacity: 0.5 },
  appleWeb: { minHeight: 52, borderRadius: 14, backgroundColor: '#000000', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing(1.5) },
  appleWebText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  verifyCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1.5, borderRadius: 20, padding: spacing(3) },
  verifyIcon: { fontSize: 42, textAlign: 'center', marginBottom: spacing(1) },
  cardTitle: { ...type.heading, textAlign: 'center', marginBottom: spacing(1) },
  cardBody: { ...type.body, textAlign: 'center', marginBottom: spacing(3) },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1) },
  textButtonLabel: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  note: { textAlign: 'center', marginTop: spacing(3) },
});

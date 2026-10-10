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
import SocialButton from '../components/SocialButton';
import { ChunkyButton, PLAY, Ribbon, type PlayColour } from '../components/Playful';
import WelcomeScreen, { Background, useReduceMotion } from './WelcomeScreen';
import { useAuth } from '../auth/AuthContext';
import { idleMinutes, takeIdleSignOutNotice } from '../auth/idle';
import { PRIVACY_PATH, openPublicPage } from '../legal';
import { colors, spacing, type, column, GUTTER } from '../theme';

export default function LoginScreen() {
  const { loading, configured, signIn, signInWithApple, signInWithEmail, signUpWithEmail, resendVerification } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'create'>('signIn');
  const [showWelcome, setShowWelcome] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<'google' | 'apple' | 'facebook' | 'email' | 'resend' | null>(null);
  // Apple's own button on iPhone. On Android and web, Apple sign-in needs an
  // Apple "Services ID" set up in Supabase first, so it is shown only once
  // EXPO_PUBLIC_APPLE_SIGNIN_WEB=1 says that has been done.
  const [appleNative, setAppleNative] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleNative).catch(() => setAppleNative(false));
  }, []);
  const showApple = Platform.OS === 'ios' ? appleNative : process.env.EXPO_PUBLIC_APPLE_SIGNIN_WEB === '1';
  // Facebook needs a Facebook app set up in Supabase first, so the button is
  // shown only once EXPO_PUBLIC_FACEBOOK_SIGNIN=1 says that has been done.
  const showFacebook = process.env.EXPO_PUBLIC_FACEBOOK_SIGNIN === '1';
  const socialNames = [showApple && 'Apple', 'Google', showFacebook && 'Facebook'].filter(Boolean) as string[];
  const socialList = socialNames.length > 1 ? `${socialNames.slice(0, -1).join(', ')} or ${socialNames[socialNames.length - 1]}` : socialNames[0]!;
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Explain an automatic sign-out once, so it does not look like a fault.
  useEffect(() => {
    void takeIdleSignOutNotice().then(wasIdle => {
      if (wasIdle) setNotice(`You were signed out after ${idleMinutes()} without activity, to keep your account safe. Please sign in again.`);
    });
  }, []);

  function showError(err: unknown) {
    const message = err instanceof Error ? err.message : 'Sign-in failed.';
    if (/email not confirmed/i.test(message)) {
      setVerificationEmail(email.trim().toLowerCase());
      setError('Please verify your email before signing in.');
    } else if (/user is banned|banned/i.test(message)) {
      // Deleted accounts are blocked from signing in during the 30-day grace period.
      setError('This account was deleted. It will be permanently erased 30 days after deletion. To restore it before then, contact the KidCog team.');
    } else if (/provider is not enabled|unsupported provider/i.test(message)) {
      setError('This sign-in option is not switched on yet. Please use another option for now.');
    } else if (/invalid login credentials/i.test(message)) {
      setError(`That email or password does not match. If you previously used ${socialList}, continue with that below. Otherwise, create an email account first.`);
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

  async function startFacebook() {
    setBusy('facebook'); setError(null); setNotice(null);
    try { await signIn('facebook'); }
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

  const still = useReduceMotion();

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (showWelcome && !verificationEmail) {
    return <WelcomeScreen
      onChoose={() => { setMode('create'); setError(null); setShowWelcome(false); }}
      onParentSignIn={() => { setMode('signIn'); setError(null); setShowWelcome(false); }}
    />;
  }
  // Sign in is sky blue; making a new account is green ("growing" a family account).
  const joining = mode === 'create' && !verificationEmail;
  const theme: PlayColour = joining ? 'grass' : 'sky';
  const tint = PLAY[theme];
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Background still={still} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Pressable
            onPress={() => { setShowWelcome(true); setError(null); }}
            accessibilityRole="button"
            accessibilityLabel="Back to activities"
            style={({ pressed }) => [styles.backButton, pressed && styles.backPressed]}
          >
            <Text style={styles.backButtonText}>← Back to the games</Text>
          </Pressable>

          {!configured ? <Text style={styles.error}>Supabase is not configured. Copy app/.env.example to app/.env and add your project URL and public key.</Text> : null}

          <View style={[styles.card, { borderColor: tint.face }]}>
            <Ribbon text={verificationEmail ? '📬 ONE MORE STEP' : joining ? '🌱 FREE FAMILY ACCOUNT' : '🔐 GROWN-UPS SIGN IN HERE'} colour={verificationEmail ? 'sun' : theme} />
            <Text style={[styles.sticker, styles.stickerLeft]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">⭐</Text>
            <Text style={[styles.sticker, styles.stickerRight]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{joining ? '🎈' : '🧩'}</Text>
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
              <View style={[styles.tabs, { backgroundColor: tint.soft }]}>
                <Pressable onPress={() => { setMode('signIn'); setError(null); }} style={[styles.tab, mode === 'signIn' && [styles.tabActive, { backgroundColor: PLAY.sky.face, borderColor: PLAY.sky.lip }]]} accessibilityRole="tab" accessibilityState={{ selected: mode === 'signIn' }}>
                  <Text style={styles.tabIcon}>🔑</Text><Text style={[styles.tabText, mode === 'signIn' && styles.tabTextActive]}>Sign in</Text>
                </Pressable>
                <Pressable onPress={() => { setMode('create'); setError(null); }} style={[styles.tab, mode === 'create' && [styles.tabActive, { backgroundColor: PLAY.grass.face, borderColor: PLAY.grass.lip }]]} accessibilityRole="tab" accessibilityState={{ selected: mode === 'create' }}>
                  <Text style={styles.tabIcon}>🌱</Text><Text style={[styles.tabText, mode === 'create' && styles.tabTextActive]}>Create account</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, { color: tint.lip }]}>📧  Grown-up’s email</Text>
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
                style={[styles.input, { borderColor: tint.face + '55' }]}
              />
              <Text style={[styles.label, { color: tint.lip }]}>🔒  Password</Text>
              <View style={styles.passwordRow}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={mode === 'create' ? 'At least 8 characters' : 'Your password'}
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                textContentType={mode === 'create' ? 'newPassword' : 'password'}
                secureTextEntry={!showPassword}
                onSubmitEditing={() => void submitEmail()}
                style={[styles.input, styles.passwordInput, { borderColor: tint.face + '55' }]}
              />
              <Pressable
                onPress={() => setShowPassword(v => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={8}
                style={styles.showPassword}
              >
                <Text style={[styles.showPasswordText, { color: tint.lip }]}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
              </View>
              {mode === 'create' ? <Text style={styles.helper}>We’ll email you a link to verify this parent account.</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {notice ? <Text style={styles.notice}>{notice}</Text> : null}
              <ChunkyButton
                colour={mode === 'create' ? 'coral' : 'sky'}
                title={busy === 'email' ? (mode === 'create' ? 'Creating account…' : 'Signing in…') : (mode === 'create' ? 'Create parent account' : 'Sign in with email')}
                onPress={() => void submitEmail()}
                disabled={!configured || busy !== null}
                loading={busy === 'email'}
              />
              {mode === 'signIn' ? (
                <Text style={styles.signInHint}>Signed up with {socialList}? Use the same button below — those accounts don’t have a KidCog password.</Text>
              ) : null}

              <View style={styles.divider}><View style={styles.rule} /><Text style={styles.or}>OR</Text><View style={styles.rule} /></View>
              {showApple ? (
                Platform.OS === 'ios' ? (
                  // Apple's own button, as its design guidelines require on iOS.
                  <View style={[styles.appleWrap, (!configured || busy !== null) && styles.appleBusy, { pointerEvents: !configured || busy !== null ? 'none' : 'auto' }]}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={14}
                      style={styles.appleButton}
                      onPress={() => void startApple()}
                    />
                  </View>
                ) : (
                  <SocialButton provider="apple" onPress={() => void startApple()} disabled={!configured || busy !== null} busy={busy === 'apple'} />
                )
              ) : null}
              <SocialButton provider="google" onPress={() => void startGoogle()} disabled={!configured || busy !== null} busy={busy === 'google'} />
              {showFacebook ? (
                <SocialButton provider="facebook" onPress={() => void startFacebook()} disabled={!configured || busy !== null} busy={busy === 'facebook'} />
              ) : null}
            </>
          )}
          </View>
          <View style={styles.kidNote}>
            <Text style={styles.kidNoteIcon}>🧒</Text>
            <Text style={styles.kidNoteText}>Kids: ask a grown-up to help with this page!</Text>
          </View>
          <Text style={[type.soft, styles.note]}>This account belongs to the parent or guardian. Children do not sign in.</Text>
          <Pressable onPress={() => openPublicPage(PRIVACY_PATH)} accessibilityRole="link" style={styles.privacyLink}>
            <Text style={styles.privacyText}>Privacy policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing(2) },
  container: { paddingVertical: spacing(2), paddingHorizontal: GUTTER, ...column, maxWidth: 540 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(1.75), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 4, borderColor: '#F3D9C9' },
  backPressed: { borderBottomWidth: 2, marginTop: 2 },
  backButtonText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  card: { marginTop: spacing(4.5), backgroundColor: '#FFFFFF', borderRadius: 30, borderWidth: 4, borderBottomWidth: 9, padding: spacing(2.5), paddingTop: spacing(4) },
  sticker: { position: 'absolute', fontSize: 30 },
  stickerLeft: { top: -20, left: -12, transform: [{ rotate: '-14deg' }] },
  stickerRight: { bottom: -22, right: -10, transform: [{ rotate: '12deg' }] },
  tabIcon: { fontSize: 16 },
  kidNote: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), alignSelf: 'center', marginTop: spacing(3.5), paddingVertical: spacing(1), paddingHorizontal: spacing(2), borderRadius: 999, backgroundColor: '#FFF4D2', borderWidth: 2.5, borderBottomWidth: 4, borderColor: '#FFC83D' },
  kidNoteIcon: { fontSize: 20 },
  kidNoteText: { flexShrink: 1, fontSize: 14, fontWeight: '800', color: '#7A4E08' },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 5, marginBottom: spacing(2.5), gap: 4 },
  tab: { flex: 1, minHeight: 50, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  tabActive: { borderBottomWidth: 4 },
  tabText: { fontSize: 15, fontWeight: '900', color: '#4A5A70' },
  tabTextActive: { color: '#FFFFFF' },
  label: { fontSize: 15, fontWeight: '900', marginBottom: spacing(1) },
  input: { minHeight: 56, borderWidth: 2.5, borderRadius: 18, backgroundColor: '#FFFDF8', color: colors.ink, fontSize: 17, paddingHorizontal: spacing(2), marginBottom: spacing(2) },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 76 },
  showPassword: { position: 'absolute', right: spacing(1), top: 0, height: 56, minWidth: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(1) },
  showPasswordText: { fontSize: 15, fontWeight: '900' },
  helper: { ...type.soft, marginTop: -spacing(1), marginBottom: spacing(2) },
  signInHint: { ...type.soft, textAlign: 'center', marginTop: spacing(2) },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  privacyLink: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  privacyText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft, textDecorationLine: 'underline' },
  notice: { color: colors.accent, backgroundColor: colors.accentSoft, padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing(3) },
  rule: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.line },
  or: { ...type.label, marginHorizontal: spacing(2) },
  // Same height as the other buttons, so Apple is at least as prominent as Google (App Review 4.8).
  appleWrap: { marginBottom: spacing(1.5) },
  appleButton: { width: '100%', height: 52 },
  appleBusy: { opacity: 0.5 },
  verifyCard: { paddingVertical: spacing(1) },
  verifyIcon: { fontSize: 42, textAlign: 'center', marginBottom: spacing(1) },
  cardTitle: { ...type.heading, textAlign: 'center', marginBottom: spacing(1) },
  cardBody: { ...type.body, textAlign: 'center', marginBottom: spacing(3) },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1) },
  textButtonLabel: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  note: { textAlign: 'center', marginTop: spacing(1.5) },
});

import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Button from '../components/Button';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, type } from '../theme';

export default function LoginScreen() {
  const { loading, configured, signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true); setError(null);
    try { await signIn('google'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  return <View style={styles.container}>
    <Text style={styles.mascot}>🦉</Text>
    <Text style={styles.title}>Welcome to KidCog</Text>
    <Text style={styles.body}>Sign in as a parent to keep child nicknames and assessment sessions together.</Text>
    {!configured ? <Text style={styles.error}>Supabase is not configured. Copy app/.env.example to app/.env and add your project URL and public key.</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button title={busy ? 'Signing in…' : 'Continue with Google'} onPress={() => void start()} disabled={!configured || busy} loading={busy} />
    <Text style={[type.soft, styles.note]}>This account belongs to the parent or guardian. Children do not sign in.</Text>
  </View>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, justifyContent: 'center', padding: spacing(4), maxWidth: 560, width: '100%', alignSelf: 'center' },
  mascot: { fontSize: 64, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center', color: colors.primary, marginTop: spacing(1) },
  body: { ...type.body, textAlign: 'center', marginVertical: spacing(3) },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(2), borderRadius: 12, marginBottom: spacing(2) },
  note: { textAlign: 'center', marginTop: spacing(3) },
});

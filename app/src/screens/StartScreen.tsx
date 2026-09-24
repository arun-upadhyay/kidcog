import React, { useState } from 'react';
import { Alert, Modal, Platform, View, Text, TextInput, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { ChildProfile, SavedChildProfile } from '../types';

export interface StartScreenProps {
  onStart: (profile: ChildProfile) => void;
  loading: boolean;
  error: string | null;
  savedChildren: SavedChildProfile[];
  accountEmail: string;
  accountProviders: string[];
  accountVerified: boolean;
  accountCreatedAt: string;
  onChangePassword: (password: string) => Promise<void>;
  onSignOut: () => void;
  onViewHistory: (child: SavedChildProfile) => void;
  onDeleteChild: (child: SavedChildProfile) => Promise<void>;
}

/**
 * Ages as tappable chips rather than a keyboard.
 *
 * The grown-up fills this in, so a number field would work — but chips make the
 * age-band boundary visible, which is the thing that actually changes what the
 * child gets. Someone choosing 7 versus 8 should be able to see that it matters.
 */
const AGES = [4, 5, 6, 7] as const;

export default function StartScreen({ onStart, loading, error, savedChildren, accountEmail, accountProviders, accountVerified, accountCreatedAt, onChangePassword, onSignOut, onViewHistory, onDeleteChild }: StartScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState<number | null>(5);
  const [consent, setConsent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  const canStart = consent && !loading;
  const young = age !== null && age <= 7;

  function handleStart() {
    const profile: ChildProfile = {};
    const trimmed = firstName.trim();
    if (trimmed) profile.firstName = trimmed;
    if (age !== null) profile.age = age;
    onStart(profile);
  }

  function chooseSaved(child: SavedChildProfile) {
    setFirstName(child.nickname);
    if (child.age !== null) setAge(child.age);
  }

  async function removeChild(child: SavedChildProfile) {
    setDeletingId(child.id);
    try {
      await onDeleteChild(child);
      if (firstName.trim().toLowerCase() === child.nickname.trim().toLowerCase()) setFirstName('');
    } finally { setDeletingId(null); }
  }

  function confirmDelete(child: SavedChildProfile) {
    const message = `Delete ${child.nickname}'s profile? This permanently removes every saved assessment, question, answer, and result for this child.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void removeChild(child);
      return;
    }
    Alert.alert('Delete child profile?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete profile', style: 'destructive', onPress: () => void removeChild(child) },
    ]);
  }

  function closeMenu() {
    setMenuOpen(false);
    setChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setAccountError(null);
    setAccountMessage(null);
  }

  async function savePassword() {
    setAccountError(null);
    setAccountMessage(null);
    if (newPassword.length < 8) { setAccountError('Use at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setAccountError('The passwords do not match.'); return; }
    setAccountBusy(true);
    try {
      await onChangePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
      setAccountMessage('Your password has been updated.');
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Could not update the password.');
    } finally { setAccountBusy(false); }
  }

  const providerLabel = accountProviders.map(provider => provider === 'google' ? 'Google' : provider === 'email' ? 'Email and password' : provider).join(' + ') || 'Email and password';
  const canChangePassword = accountProviders.includes('email');
  const memberSince = new Date(accountCreatedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.mascot}>🦉</Text>
        <Text style={styles.title}>KidCog</Text>
        <Text style={styles.tagline}>Thinking puzzles to do together</Text>
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open parent account menu"
          style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityLabel="Close account menu" />
          <View style={styles.accountMenu} accessibilityViewIsModal>
            <View style={styles.accountHeader}>
              <View style={styles.avatar}><Text style={styles.avatarText}>🦉</Text></View>
              <View style={styles.accountHeading}>
                <Text style={styles.accountTitle}>Parent account</Text>
                <Text style={styles.accountEmail} numberOfLines={1}>{accountEmail}</Text>
              </View>
              <Pressable onPress={closeMenu} accessibilityRole="button" accessibilityLabel="Close account menu" style={styles.closeButton}><Text style={styles.closeIcon}>×</Text></Pressable>
            </View>

            <View style={styles.accountDetails}>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={styles.verified}>{accountVerified ? '✓ Verified' : 'Verification pending'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Signed in with</Text><Text style={styles.detailValue}>{providerLabel}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Member since</Text><Text style={styles.detailValue}>{memberSince}</Text></View>
            </View>

            {accountMessage ? <Text style={styles.accountSuccess}>{accountMessage}</Text> : null}
            {changingPassword ? (
              <View style={styles.passwordPanel}>
                <Text style={styles.passwordTitle}>Set a new password</Text>
                <Text style={type.soft}>Use at least 8 characters. This password belongs to the parent account.</Text>
                <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={colors.inkSoft} secureTextEntry autoCapitalize="none" autoComplete="new-password" style={styles.accountInput} />
                <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={colors.inkSoft} secureTextEntry autoCapitalize="none" autoComplete="new-password" onSubmitEditing={() => void savePassword()} style={styles.accountInput} />
                {accountError ? <Text style={styles.accountError}>{accountError}</Text> : null}
                <Button title={accountBusy ? 'Saving…' : 'Save password'} onPress={() => void savePassword()} disabled={accountBusy} loading={accountBusy} />
                <Pressable onPress={() => { setChangingPassword(false); setAccountError(null); }} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              </View>
            ) : (
              <>
                {canChangePassword ? (
                  <Pressable onPress={() => { setChangingPassword(true); setAccountMessage(null); }} accessibilityRole="button" style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}>
                    <Text style={styles.menuActionIcon}>🔐</Text><View style={styles.menuActionCopy}><Text style={styles.menuActionTitle}>Change password</Text><Text style={type.soft}>Update the parent account password</Text></View><Text style={styles.chevron}>›</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => { closeMenu(); onSignOut(); }} accessibilityRole="button" style={({ pressed }) => [styles.menuAction, styles.signOutAction, pressed && styles.menuActionPressed]}>
                  <Text style={styles.menuActionIcon}>👋</Text><Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.card}>
        <Text style={type.heading}>For the grown-up</Text>
        <Text style={[type.body, { marginTop: spacing(1) }]}>
          This is a practice activity, not an IQ test and not a clinical assessment. It does not
          produce an IQ score, a percentile, or a comparison with other children. Treat the result as
          a snapshot of one session.
        </Text>
        <Text style={[type.soft, { marginTop: spacing(1.5) }]}>
          Spoken and written answers are sent to an AI service to be scored against a rubric. Please
          don&apos;t include your child&apos;s full name, school, or address in the answers.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={type.label}>HOW OLD ARE THEY?</Text>
        <View style={styles.chips}>
          {AGES.map((a) => {
            const on = age === a;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Age ${a}`}
                onPress={() => setAge(a)}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{a}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={type.soft}>
          {young
            ? 'Tap the speaker button to hear a question, answer by tapping or speaking, and the score is kept for you rather than shown to your child.'
            : 'Questions are read on screen and written answers are typed.'}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={type.label}>THEIR FIRST NAME (OPTIONAL)</Text>
        {savedChildren.length ? <View style={styles.savedList}>{savedChildren.map(saved => <View key={saved.id} style={styles.savedCard}>
          <Pressable onPress={() => chooseSaved(saved)} style={styles.savedName}><Text style={styles.savedNameText}>{saved.nickname}</Text><Text style={type.soft}>{saved.age !== null ? `Age ${saved.age} · ` : ''}Use this profile</Text></Pressable>
          <View style={styles.savedActions}>
            <Pressable onPress={() => onViewHistory(saved)} accessibilityRole="button" accessibilityLabel={`View ${saved.nickname}'s previous results`} accessibilityHint="Opens saved assessment reports" style={({ pressed }) => [styles.iconButton, styles.historyButton, pressed && styles.iconPressed]}><Text style={styles.actionIcon}>📚</Text></Pressable>
            <Pressable disabled={deletingId !== null} onPress={() => confirmDelete(saved)} accessibilityRole="button" accessibilityLabel={`Delete ${saved.nickname}'s profile`} accessibilityHint="Permanently removes this profile and its assessments" style={({ pressed }) => [styles.iconButton, styles.deleteProfile, (pressed || deletingId !== null) && styles.iconPressed]}><Text style={styles.actionIcon}>{deletingId === saved.id ? '⏳' : '🗑️'}</Text></Pressable>
          </View>
        </View>)}</View> : null}
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="e.g. Aanya"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="words"
          maxLength={60}
        />
        <Text style={type.soft}>Use a first name or nickname only. It and this session&apos;s questions, answers, and results are saved privately to your parent account.</Text>
      </View>

      <View style={styles.consentRow}>
        <Switch
          value={consent}
          onValueChange={setConsent}
          trackColor={{ true: colors.go, false: colors.line }}
        />
        <Text style={[type.body, styles.consentText]}>
          I am this child&apos;s parent or guardian, I understand this is a practice activity, and I
          agree to their answers being sent for AI scoring.
        </Text>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <Button
        title={loading ? 'Getting ready…' : 'Choose categories →'}
        onPress={handleStart}
        disabled={!canStart}
        loading={loading}
        uiScale={young ? 1.2 : 1}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  header: { position: 'relative' },
  mascot: { fontSize: 64, textAlign: 'center' },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing(0.5),
  },
  tagline: {
    fontSize: 17,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing(0.5),
  },
  menuButton: { position: 'absolute', left: 0, top: spacing(1), width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1.5, borderColor: '#F7C9BA' },
  menuButtonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  menuIcon: { fontSize: 27, color: colors.primary, fontWeight: '800', marginTop: -2 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(42,33,24,0.25)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  accountMenu: { position: 'absolute', top: Platform.OS === 'web' ? spacing(3) : spacing(7), left: spacing(2), width: '88%', maxWidth: 400, maxHeight: '92%', backgroundColor: colors.surface, borderRadius: 22, padding: spacing(2.5), borderWidth: 1.5, borderColor: colors.line, shadowColor: '#2A2118', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), paddingBottom: spacing(2), borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.happySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28 },
  accountHeading: { flex: 1 },
  accountTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  accountEmail: { ...type.soft, marginTop: 1 },
  closeButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  closeIcon: { fontSize: 29, color: colors.inkSoft, lineHeight: 32 },
  accountDetails: { backgroundColor: colors.coolSoft, borderRadius: 14, padding: spacing(1.5), marginVertical: spacing(2), gap: spacing(1) },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(2) },
  detailLabel: { ...type.soft, flexShrink: 0 },
  detailValue: { fontSize: 14, lineHeight: 21, color: colors.ink, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  verified: { fontSize: 14, lineHeight: 21, color: colors.go, fontWeight: '800' },
  menuAction: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1.25), paddingHorizontal: spacing(1), borderRadius: 14, gap: spacing(1.25) },
  menuActionPressed: { backgroundColor: colors.bg },
  menuActionIcon: { fontSize: 25 },
  menuActionCopy: { flex: 1 },
  menuActionTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  chevron: { fontSize: 30, color: colors.inkSoft },
  signOutAction: { marginTop: spacing(0.5), backgroundColor: '#FBE9E7' },
  signOutText: { color: colors.danger, fontSize: 16, fontWeight: '800' },
  passwordPanel: { gap: spacing(1.25) },
  passwordTitle: { ...type.heading },
  accountInput: { minHeight: 52, borderWidth: 1.5, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, paddingHorizontal: spacing(1.5) },
  accountError: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.5), borderRadius: 10 },
  accountSuccess: { color: colors.accent, backgroundColor: colors.accentSoft, padding: spacing(1.5), borderRadius: 10, marginBottom: spacing(1) },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontWeight: '700' },
  card: {
    backgroundColor: colors.coolSoft,
    borderRadius: 18,
    padding: spacing(2.5),
    marginTop: spacing(3),
  },
  field: { marginTop: spacing(3), gap: spacing(1.25) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.25) },
  chip: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.happySoft, borderColor: colors.happy },
  chipText: { fontSize: 20, fontWeight: '700', color: colors.inkSoft },
  chipTextOn: { color: colors.ink },
  savedList: { gap: spacing(1), marginBottom: spacing(1) },
  savedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.coolSoft, borderRadius: 14, padding: spacing(1.5), gap: spacing(1) },
  savedName: { flex: 1 }, savedNameText: { fontWeight: '700', color: colors.ink, fontSize: 16 },
  savedActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  historyButton: { backgroundColor: colors.goSoft },
  deleteProfile: { backgroundColor: '#FBE9E7' },
  actionIcon: { fontSize: 27 }, iconPressed: { opacity: 0.55, transform: [{ scale: 0.96 }] },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.75),
    fontSize: 16,
    color: colors.ink,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(1.5),
    marginTop: spacing(3),
    marginBottom: spacing(3),
  },
  consentText: { flex: 1, fontSize: 15, lineHeight: 22 },
  errorBanner: {
    backgroundColor: '#FBE9E7',
    color: colors.danger,
    padding: spacing(2),
    borderRadius: 12,
    marginBottom: spacing(2),
    fontSize: 15,
  },
});

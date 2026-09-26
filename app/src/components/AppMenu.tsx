import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import { colors, spacing, type } from '../theme';

/**
 * The top bar shown on every signed-in screen: the ☰ parent-account menu and
 * the KidCog name. It sits outside each screen's scroll view, so it stays
 * visible however far down the page a parent has scrolled.
 *
 * The menu holds Home, Change password, Sign out and Delete account. It used to
 * live inside the home screen's header only, which left no way back home (or
 * to the account) from any other screen.
 */
export interface AppMenuProps {
  accountEmail: string;
  accountProviders: string[];
  accountVerified: boolean;
  accountCreatedAt: string;
  onChangePassword: (password: string) => Promise<void>;
  onSignOut: () => void;
  /** Delete the parent account; resolves with when the data will be erased. */
  onDeleteAccount: () => Promise<{ purgeAfter: string; graceDays: number }>;
  /** Go to the home page. Absent on the home page itself. */
  onHome?: () => void;
}

export default function AppMenu({ accountEmail, accountProviders, accountVerified, accountCreatedAt, onChangePassword, onSignOut, onDeleteAccount, onHome }: AppMenuProps) {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [accountDeleted, setAccountDeleted] = useState<string | null>(null);

  function closeMenu() {
    setMenuOpen(false);
    setChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setAccountError(null);
    setAccountMessage(null);
    setDeletingAccount(false);
    setDeleteConfirm('');
  }

  async function confirmDeleteAccount() {
    setAccountError(null);
    if (deleteConfirm.trim() !== 'DELETE') { setAccountError('Type DELETE in capitals to confirm.'); return; }
    setAccountBusy(true);
    try {
      const { purgeAfter } = await onDeleteAccount();
      const when = new Date(purgeAfter).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      setAccountDeleted(`Your account has been deleted. Everything will be permanently erased on ${when}. Signing you out…`);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'Could not delete the account.');
    } finally { setAccountBusy(false); }
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
    <>
      <View style={styles.bar}>
        <View style={styles.barInner}>
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open parent account menu"
            style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </Pressable>
          <Pressable
            onPress={onHome}
            disabled={!onHome}
            accessibilityRole={onHome ? 'button' : 'header'}
            accessibilityLabel={onHome ? 'KidCog, go to the home page' : 'KidCog'}
            style={({ pressed }) => [styles.brand, pressed && styles.menuButtonPressed]}
          >
            <Text style={styles.brandText}>🦉 KidCog</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} accessibilityLabel="Close account menu" />
          {/* Same width as the page column, so on a wide screen the menu opens
              under the ☰ button instead of at the window's far-left edge.
              box-none: taps outside the panel still reach the backdrop. */}
          <View style={styles.menuColumn} pointerEvents="box-none">
          <View style={[styles.accountMenu, { top: insets.top + spacing(1) }]} accessibilityViewIsModal>
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
            {accountDeleted ? (
              <Text style={styles.accountSuccess} accessibilityLiveRegion="polite">{accountDeleted}</Text>
            ) : deletingAccount ? (
              <View style={styles.passwordPanel}>
                <Text style={[styles.passwordTitle, { color: colors.danger }]}>Delete your account?</Text>
                <Text style={type.soft}>
                  This deletes your parent account and every child profile, test, answer and result saved in it.
                  You will be signed out on all your devices straight away.
                </Text>
                <View style={styles.deleteNote}>
                  <Text style={styles.deleteNoteText}>
                    Your data is kept for 30 days in case this was a mistake, then permanently erased. To restore
                    the account within those 30 days, contact the KidCog team.
                  </Text>
                </View>
                <Text style={styles.deleteLabel}>Type DELETE to confirm</Text>
                <TextInput
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  placeholder="DELETE"
                  placeholderTextColor={colors.inkSoft}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  accessibilityLabel="Type DELETE to confirm"
                  onSubmitEditing={() => void confirmDeleteAccount()}
                  style={styles.accountInput}
                />
                {accountError ? <Text style={styles.accountError}>{accountError}</Text> : null}
                <Pressable
                  onPress={() => void confirmDeleteAccount()}
                  disabled={accountBusy || deleteConfirm.trim() !== 'DELETE'}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: accountBusy || deleteConfirm.trim() !== 'DELETE', busy: accountBusy }}
                  style={({ pressed }) => [styles.deleteButton, (accountBusy || deleteConfirm.trim() !== 'DELETE') && styles.deleteButtonDisabled, pressed && styles.menuActionPressed]}
                >
                  <Text style={styles.deleteButtonText}>{accountBusy ? 'Deleting…' : 'Delete my account'}</Text>
                </Pressable>
                <Pressable onPress={() => { setDeletingAccount(false); setDeleteConfirm(''); setAccountError(null); }} style={styles.cancelButton} accessibilityRole="button"><Text style={styles.cancelText}>Keep my account</Text></Pressable>
              </View>
            ) : changingPassword ? (
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
                {onHome ? (
                  <Pressable onPress={() => { closeMenu(); onHome(); }} accessibilityRole="button" accessibilityLabel="Go to the home page" style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}>
                    <Text style={styles.menuActionIcon}>🏠</Text><View style={styles.menuActionCopy}><Text style={styles.menuActionTitle}>Home</Text><Text style={type.soft}>Back to choosing a child</Text></View><Text style={styles.chevron}>›</Text>
                  </Pressable>
                ) : null}
                {canChangePassword ? (
                  <Pressable onPress={() => { setChangingPassword(true); setAccountMessage(null); }} accessibilityRole="button" style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}>
                    <Text style={styles.menuActionIcon}>🔐</Text><View style={styles.menuActionCopy}><Text style={styles.menuActionTitle}>Change password</Text><Text style={type.soft}>Update the parent account password</Text></View><Text style={styles.chevron}>›</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => { closeMenu(); onSignOut(); }} accessibilityRole="button" style={({ pressed }) => [styles.menuAction, styles.signOutAction, pressed && styles.menuActionPressed]}>
                  <Text style={styles.menuActionIcon}>👋</Text><Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
                <Pressable onPress={() => { setDeletingAccount(true); setAccountMessage(null); setAccountError(null); }} accessibilityRole="button" accessibilityLabel="Delete account" style={({ pressed }) => [styles.deleteAccountLink, pressed && styles.menuActionPressed]}>
                  <Text style={styles.deleteAccountLinkText}>Delete account</Text>
                </Pressable>
              </>
            )}
          </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#FFF8EF', borderBottomWidth: 1, borderBottomColor: '#EEDFCB' },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: spacing(2.5), paddingVertical: spacing(1) },
  brand: { paddingVertical: spacing(0.5), paddingHorizontal: spacing(0.5), borderRadius: 10 },
  brandText: { fontSize: 20, fontWeight: '900', color: '#6B4BB0' },
  menuButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0' },
  menuButtonPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  menuIcon: { fontSize: 25, color: '#6B4BB0', fontWeight: '800', marginTop: -2 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(42,33,24,0.25)' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  // In normal flow (not absolute): an absolute column with top/bottom 0 collapsed
  // to zero height on web, which squashed the panel into a thin strip.
  menuColumn: { flex: 1, width: '100%', maxWidth: 850, alignSelf: 'center' },
  accountMenu: { position: 'absolute', left: spacing(2.5), width: '88%', maxWidth: 400, maxHeight: '92%', backgroundColor: colors.surface, borderRadius: 22, padding: spacing(2.5), borderWidth: 1.5, borderColor: colors.line, shadowColor: '#2A2118', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
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
  deleteNote: { backgroundColor: '#FFF0EE', borderWidth: 1.5, borderColor: '#F2A28E', borderRadius: 12, padding: spacing(1.25) },
  deleteNoteText: { fontSize: 13, lineHeight: 19, color: '#855A51' },
  deleteLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.inkSoft, marginTop: spacing(0.5) },
  deleteButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  deleteButtonDisabled: { opacity: 0.4 },
  deleteButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  deleteAccountLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing(0.5), borderRadius: 12 },
  deleteAccountLinkText: { color: colors.danger, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  passwordTitle: { ...type.heading },
  accountInput: { minHeight: 52, borderWidth: 1.5, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, paddingHorizontal: spacing(1.5) },
  accountError: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.5), borderRadius: 10 },
  accountSuccess: { color: colors.accent, backgroundColor: colors.accentSoft, padding: spacing(1.5), borderRadius: 10, marginBottom: spacing(1) },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontWeight: '700' },
});

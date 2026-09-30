import React, { useEffect, useState } from 'react';
import { Alert, Platform, View, Text, TextInput, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AboutSheet from '../components/AboutSheet';
import Sheet from '../components/Sheet';
import Button from '../components/Button';
import { colors, spacing, type, column, GUTTER } from '../theme';
import type { ChildProfile, SavedChildProfile } from '../types';
import { avatarEmoji, defaultAvatarKey, avatarName, firstFreeAvatar } from '../avatars';
import { AvatarBrowser, AvatarQuickPick } from '../components/AvatarPicker';
import { AVATARS } from '../avatars';
import { loadProgress, type ChildProgress } from '../progress';

export interface StartScreenProps {
  onStart: (profile: ChildProfile) => void;
  loading: boolean;
  error: string | null;
  savedChildren: SavedChildProfile[];
  onViewHistory: (child: SavedChildProfile) => void;
  onDeleteChild: (child: SavedChildProfile) => Promise<void>;
  onChangeAvatar: (child: SavedChildProfile, avatar: string) => Promise<void>;
}

/** Shown once, the first time a parent reaches this screen on this device. */
const ABOUT_SEEN_KEY = 'kidcog.aboutSeen.v1';

/**
 * Ages as tappable chips rather than a keyboard.
 *
 * The grown-up fills this in, so a number field would work — but chips make the
 * age-band boundary visible, which is the thing that actually changes what the
 * child gets. Someone choosing 7 versus 8 should be able to see that it matters.
 */
const AGES = [4, 5, 6, 7] as const;
const AGE_ICONS: Record<(typeof AGES)[number], string> = { 4: '🐣', 5: '⭐', 6: '🚀', 7: '🦄' };
const PROFILE_COLORS = ['#E5F3FF', '#FFF0D9', '#E5F5EA', '#F2EAFE'] as const;

export default function StartScreen({ onStart, loading, error, savedChildren, onViewHistory, onDeleteChild, onChangeAvatar }: StartScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState<number | null>(5);
  const [consent, setConsent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Kept simple on purpose: saved children are big tiles, and the new-child
  // form (nickname + age) only appears when adding one.
  const [adding, setAdding] = useState(false);
  const [actionsFor, setActionsFor] = useState<SavedChildProfile | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Picture for a new child, and the saved child whose picture is being changed.
  const [avatar, setAvatar] = useState<string>(() => firstFreeAvatar(savedChildren.map(c => c.avatar)));
  const [pictureFor, setPictureFor] = useState<SavedChildProfile | null>(null);
  const [savingPicture, setSavingPicture] = useState<string | null>(null);
  const [pictureError, setPictureError] = useState<string | null>(null);
  // Stars and stickers per child (kept on this device), and whose sticker book is open.
  const [progressById, setProgressById] = useState<Record<string, ChildProgress>>({});
  const [bookFor, setBookFor] = useState<SavedChildProfile | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all(savedChildren.map(async c => [c.id, await loadProgress(c.id)] as const)).then(pairs => { if (live) setProgressById(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [savedChildren]);

  useEffect(() => {
    AsyncStorage.getItem(ABOUT_SEEN_KEY).then(seen => { if (!seen) setAboutOpen(true); }).catch(() => {});
  }, []);
  function closeAbout() {
    setAboutOpen(false);
    AsyncStorage.setItem(ABOUT_SEEN_KEY, '1').catch(() => {});
  }

  const showNewForm = adding || savedChildren.length === 0;
  const selected = showNewForm ? undefined : savedChildren.find(c => c.nickname.trim().toLowerCase() === firstName.trim().toLowerCase());
  const needsAge = showNewForm || (selected !== undefined && selected.age === null);
  const canStart = consent && !loading && (showNewForm || selected !== undefined);
  const young = age !== null && age <= 7;

  function handleStart() {
    const profile: ChildProfile = {};
    const trimmed = firstName.trim();
    if (trimmed) profile.firstName = trimmed;
    if (age !== null) profile.age = age;
    if (showNewForm) profile.avatar = avatar;
    onStart(profile);
  }

  function startAdding() {
    setAdding(true);
    setFirstName('');
    setAge(5);
    setAvatar(firstFreeAvatar(savedChildren.map(c => c.avatar)));
  }

  function chooseSaved(child: SavedChildProfile) {
    setAdding(false);
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

  async function pickPicture(child: SavedChildProfile, key: string) {
    if (key === child.avatar) { setPictureFor(null); return; }
    setSavingPicture(key);
    setPictureError(null);
    try {
      await onChangeAvatar(child, key);
      setPictureFor(null);
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : 'Could not change the picture.');
    } finally { setSavingPicture(null); }
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


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.hello}>
        <View style={styles.helloOwl}><Text style={styles.helloOwlText}>🦉</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.helloTitle}>Who’s playing today?</Text>
          <Text style={styles.helloHint}>{showNewForm ? 'Add a player to start' : 'Tap a player to start'}</Text>
        </View>
        <Pressable onPress={() => setAboutOpen(true)} accessibilityRole="button" accessibilityLabel="About KidCog" hitSlop={8} style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}>
          <Text style={styles.infoText}>ⓘ</Text>
        </Pressable>
      </View>

      {!showNewForm ? (
        <View style={styles.tiles}>
          {savedChildren.map((saved, index) => {
            const on = selected?.id === saved.id;
            return (
              <View key={saved.id} style={styles.tileWrap}>
                <Pressable
                  onPress={() => chooseSaved(saved)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${saved.nickname}${saved.age !== null ? `, age ${saved.age}` : ''}`}
                  style={({ pressed }) => [styles.tile, { backgroundColor: PROFILE_COLORS[index % PROFILE_COLORS.length] }, on && styles.tileOn, pressed && styles.pressed]}
                >
                  <Text style={styles.tileAvatar}>{avatarEmoji(saved.avatar, index)}</Text>
                  <Text style={styles.tileName} numberOfLines={1}>{saved.nickname}</Text>
                  {saved.age !== null ? <Text style={styles.tileAge}>Age {saved.age}</Text> : null}
                  {(progressById[saved.id]?.stars ?? 0) > 0 ? <Text style={styles.tileStars}>⭐ {progressById[saved.id]!.stars}</Text> : null}
                  {on ? <View style={styles.tileCheck}><Text style={styles.tileCheckText}>✓</Text></View> : null}
                </Pressable>
                <Pressable
                  onPress={() => setActionsFor(saved)}
                  accessibilityRole="button"
                  accessibilityLabel={`More options for ${saved.nickname}`}
                  hitSlop={6}
                  style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
                >
                  <Text style={styles.moreText}>{deletingId === saved.id ? '⏳' : '⋯'}</Text>
                </Pressable>
              </View>
            );
          })}
          <View style={styles.tileWrap}>
            <Pressable onPress={startAdding} accessibilityRole="button" accessibilityLabel="Add a child" style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed]}>
              <Text style={styles.addPlus}>＋</Text>
              <Text style={styles.addText}>Add a child</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.newCard}>
          <View style={styles.newTop}>
            <View style={styles.previewCircle} accessibilityLabel={`Picture: ${avatarName(avatar)}`}>
              <Text style={styles.previewEmoji}>{avatarEmoji(avatar)}</Text>
            </View>
            <View style={{ flex: 1 }}>
          <Text style={styles.label}>Nickname</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g. Aanya"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="words"
            maxLength={60}
          />
            </View>
          </View>
          <Text style={[styles.label, { marginTop: spacing(2) }]}>Pick a picture</Text>
          <AvatarQuickPick selected={avatar} onPick={setAvatar} />
        </View>
      )}

      {needsAge ? (
        <View style={styles.ageBlock}>
          <Text style={styles.label}>Age</Text>
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
                  style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                >
                  <Text style={styles.ageIcon}>{AGE_ICONS[a]}</Text>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{a}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {showNewForm && savedChildren.length > 0 ? (
        <Pressable onPress={() => setAdding(false)} accessibilityRole="button" style={styles.backLink}>
          <Text style={styles.backLinkText}>← Back to saved players</Text>
        </Pressable>
      ) : null}

      <View style={styles.consentRow}>
        <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.go, false: colors.line }} accessibilityLabel="I'm the parent or guardian and agree to how KidCog checks answers" />
        <Text style={styles.consentText}>
          I’m the parent or guardian and agree to how KidCog checks answers.{' '}
          <Text style={styles.learnMore} onPress={() => setAboutOpen(true)} accessibilityRole="link">Learn more</Text>
        </Text>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <Button
        title={loading ? 'Getting ready…' : 'Choose an adventure →'}
        onPress={handleStart}
        disabled={!canStart}
        loading={loading}
        uiScale={young ? 1.2 : 1}
      />

      <AboutSheet visible={aboutOpen} onClose={closeAbout} />

      {/* ⋯ on a player: past results or delete, kept off the tiles themselves. */}
      <Sheet visible={actionsFor !== null} onClose={() => setActionsFor(null)} closeLabel="Close options">
            <Text style={styles.sheetTitle}>{actionsFor?.nickname}</Text>
            <Pressable
              onPress={() => { const child = actionsFor; setActionsFor(null); if (child) onViewHistory(child); }}
              accessibilityRole="button"
              accessibilityLabel={actionsFor ? `View ${actionsFor.nickname}'s previous results` : 'View previous results'}
              style={({ pressed }) => [styles.sheetAction, pressed && styles.sheetActionPressed]}
            >
              <Text style={styles.sheetIcon}>📚</Text><Text style={styles.sheetActionText}>Past results</Text><Text style={styles.sheetChevron}>›</Text>
            </Pressable>
            <Pressable
              onPress={() => { const child = actionsFor; setActionsFor(null); if (child) setBookFor(child); }}
              accessibilityRole="button"
              accessibilityLabel={actionsFor ? `${actionsFor.nickname}'s sticker book` : 'Sticker book'}
              style={({ pressed }) => [styles.sheetAction, pressed && styles.sheetActionPressed]}
            >
              <Text style={styles.sheetIcon}>📒</Text><Text style={styles.sheetActionText}>Sticker book</Text>
              <Text style={styles.sheetCount}>{actionsFor ? (progressById[actionsFor.id]?.stickers.length ?? 0) : 0}</Text><Text style={styles.sheetChevron}>›</Text>
            </Pressable>
            <Pressable
              onPress={() => { const child = actionsFor; setActionsFor(null); setPictureError(null); if (child) setPictureFor(child); }}
              accessibilityRole="button"
              accessibilityLabel={actionsFor ? `Change ${actionsFor.nickname}'s picture` : 'Change picture'}
              style={({ pressed }) => [styles.sheetAction, pressed && styles.sheetActionPressed]}
            >
              <Text style={styles.sheetIcon}>{actionsFor ? avatarEmoji(actionsFor.avatar, savedChildren.findIndex(c => c.id === actionsFor.id)) : '🐻'}</Text><Text style={styles.sheetActionText}>Change picture</Text><Text style={styles.sheetChevron}>›</Text>
            </Pressable>
            <Pressable
              onPress={() => { const child = actionsFor; setActionsFor(null); if (child) confirmDelete(child); }}
              disabled={deletingId !== null}
              accessibilityRole="button"
              accessibilityLabel={actionsFor ? `Delete ${actionsFor.nickname}'s profile` : 'Delete profile'}
              style={({ pressed }) => [styles.sheetAction, pressed && styles.sheetActionPressed]}
            >
              <Text style={styles.sheetIcon}>🗑️</Text><Text style={[styles.sheetActionText, { color: colors.danger }]}>Delete profile</Text>
            </Pressable>
            <Pressable onPress={() => setActionsFor(null)} accessibilityRole="button" style={styles.sheetCancel}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
      </Sheet>

      <Sheet visible={bookFor !== null} onClose={() => setBookFor(null)} closeLabel="Close sticker book">
        <Text style={styles.sheetTitle}>{bookFor ? `${bookFor.nickname}’s stickers` : 'Stickers'}</Text>
        {bookFor ? (
          <Text style={styles.bookSub}>
            {(progressById[bookFor.id]?.stickers.length ?? 0)} of {AVATARS.length} collected · ⭐ {progressById[bookFor.id]?.stars ?? 0} stars
          </Text>
        ) : null}
        <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={styles.bookGrid}>
          {AVATARS.map(a => {
            const owned = bookFor ? progressById[bookFor.id]?.stickers.includes(a.key) : false;
            return (
              <View key={a.key} style={[styles.bookSlot, owned && styles.bookSlotOwned]} accessibilityLabel={owned ? a.name : 'Not collected yet'}>
                <Text style={[styles.bookEmoji, !owned && styles.bookEmojiLocked]}>{owned ? a.emoji : '?'}</Text>
              </View>
            );
          })}
        </ScrollView>
        <Text style={styles.bookHint}>Finish a round to win a new sticker!</Text>
        <Pressable onPress={() => setBookFor(null)} accessibilityRole="button" style={styles.sheetCancel}>
          <Text style={styles.sheetCancelText}>Close</Text>
        </Pressable>
      </Sheet>

      <Sheet visible={pictureFor !== null} onClose={() => { if (!savingPicture) setPictureFor(null); }} closeLabel="Close pictures">
        <Text style={styles.sheetTitle}>Pick a picture{pictureFor ? ` for ${pictureFor.nickname}` : ''}</Text>
        <AvatarBrowser
          selected={pictureFor ? (pictureFor.avatar ?? defaultAvatarKey(Math.max(0, savedChildren.findIndex(c => c.id === pictureFor.id)))) : null}
          busyKey={savingPicture}
          onPick={(key) => { if (pictureFor && !savingPicture) void pickPicture(pictureFor, key); }}
        />
        {pictureError ? <Text style={[styles.errorBanner, { marginTop: spacing(1.5) }]}>{pictureError}</Text> : null}
        <Pressable onPress={() => setPictureFor(null)} disabled={savingPicture !== null} accessibilityRole="button" style={styles.sheetCancel}>
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </Pressable>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: GUTTER, paddingBottom: spacing(6), ...column, gap: spacing(2) },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  hello: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#EEE9FF', borderRadius: 24, borderWidth: 2, borderColor: '#CABAF0', padding: spacing(2) },
  helloOwl: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  helloOwlText: { fontSize: 34 },
  helloTitle: { fontSize: 22, lineHeight: 27, fontWeight: '900', color: '#6B4BB0' },
  helloHint: { fontSize: 14, color: '#6D5B91', marginTop: 2 },
  infoButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 20, color: '#6B4BB0', fontWeight: '800' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.75) },
  tileWrap: { width: '50%', padding: spacing(0.75), maxWidth: 200 },
  tile: { minHeight: 132, borderRadius: 22, borderWidth: 3, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: spacing(1.5) },
  tileOn: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tileAvatar: { fontSize: 44 },
  tileName: { fontSize: 18, fontWeight: '900', color: '#513A27', marginTop: spacing(0.5), maxWidth: '100%' },
  tileStars: { fontSize: 13, fontWeight: '900', color: '#8A5A0A', marginTop: 2 },
  sheetCount: { fontSize: 15, fontWeight: '900', color: colors.inkSoft },
  bookSub: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.inkSoft, marginTop: -spacing(1), marginBottom: spacing(1.5) },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingBottom: spacing(1) },
  bookSlot: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#F3EEE7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E8DFD2', borderStyle: 'dashed' },
  bookSlotOwned: { backgroundColor: colors.happySoft, borderColor: colors.happy, borderStyle: 'solid' },
  bookEmoji: { fontSize: 30 },
  bookEmojiLocked: { fontSize: 18, fontWeight: '900', color: '#C9BBA7' },
  bookHint: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginTop: spacing(1) },
  tileAge: { fontSize: 13, fontWeight: '700', color: '#75695F', marginTop: 1 },
  tileCheck: { position: 'absolute', left: 10, top: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.go, alignItems: 'center', justifyContent: 'center' },
  tileCheckText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  moreButton: { position: 'absolute', right: spacing(1.5), top: spacing(1.5), width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 18, fontWeight: '900', color: '#6F655D', marginTop: -4 },
  addTile: { backgroundColor: '#FFFFFF', borderColor: '#E3D4BF', borderStyle: 'dashed', borderWidth: 2 },
  addPlus: { fontSize: 34, color: colors.primary, fontWeight: '700' },
  addText: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: spacing(0.5) },

  newTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  previewCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFF0D9', borderWidth: 3, borderColor: colors.happy, alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 44 },
  newCard: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EEDFCB', borderRadius: 22, padding: spacing(2) },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: '#8B7460', marginBottom: spacing(1) },
  input: { backgroundColor: '#FFF9F0', borderWidth: 2, borderColor: '#E8D5BA', borderRadius: 16, paddingHorizontal: spacing(2), paddingVertical: spacing(1.75), fontSize: 18, color: colors.ink },
  ageBlock: { },
  chips: { flexDirection: 'row', gap: spacing(1) },
  chip: { flex: 1, height: 76, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.happySoft, borderColor: colors.happy },
  ageIcon: { fontSize: 26 },
  chipText: { fontSize: 16, fontWeight: '900', color: colors.inkSoft, marginTop: 2 },
  chipTextOn: { color: '#8A5A0A' },
  backLink: { alignSelf: 'flex-start', paddingVertical: spacing(0.5) },
  backLinkText: { color: colors.primary, fontWeight: '800', fontSize: 14 },

  consentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#E5F5EA', borderRadius: 18, borderWidth: 1.5, borderColor: '#A9D7B8', paddingVertical: spacing(1.25), paddingHorizontal: spacing(1.5) },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#34734E', fontWeight: '600' },
  learnMore: { color: '#2F6F9D', fontWeight: '800', textDecorationLine: 'underline' },
  errorBanner: { backgroundColor: '#FBE9E7', color: colors.danger, padding: spacing(2), borderRadius: 12, fontSize: 15 },

  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#513A27', textAlign: 'center', marginBottom: spacing(1.5) },
  sheetAction: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), minHeight: 58, paddingHorizontal: spacing(1.5), borderRadius: 16 },
  sheetActionPressed: { backgroundColor: colors.bg },
  sheetIcon: { fontSize: 24 },
  sheetActionText: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  sheetChevron: { fontSize: 26, color: colors.inkSoft },
  sheetCancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1), borderRadius: 16, backgroundColor: colors.bg },
  sheetCancelText: { fontSize: 16, fontWeight: '800', color: colors.inkSoft },
});

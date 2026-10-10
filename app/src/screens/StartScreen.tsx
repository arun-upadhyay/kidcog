import React, { useEffect, useState } from 'react';
import { Alert, Platform, View, Text, TextInput, StyleSheet, ScrollView, Switch, Pressable, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AboutSheet from '../components/AboutSheet';
import Sheet from '../components/Sheet';
import { ChunkyButton, OwlStage, PLAY, Ribbon, type PlayColour } from '../components/Playful';
import { colors, spacing, type, column, GUTTER } from '../theme';
import type { ChildProfile, SavedChildProfile } from '../types';
import { avatarEmoji, defaultAvatarKey, avatarName, firstFreeAvatar } from '../avatars';
import { AvatarBrowser, AvatarQuickPick } from '../components/AvatarPicker';
import { AVATARS } from '../avatars';
import { loadProgress, type ChildProgress } from '../progress';
import { useAppHeaderScroll } from '../headerScroll';

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
/** The grown-up's agreement, remembered on this device so it isn't asked every visit. */
const CONSENT_KEY = 'kidcog.parentConsent.v1';

/**
 * Ages as tappable chips rather than a keyboard.
 *
 * The grown-up fills this in, so a number field would work — but chips make the
 * age-band boundary visible, which is the thing that actually changes what the
 * child gets. Someone choosing 7 versus 8 should be able to see that it matters.
 */
const AGES = [4, 5, 6, 7] as const;
const AGE_ICONS: Record<(typeof AGES)[number], string> = { 4: '🐣', 5: '⭐', 6: '🚀', 7: '🦄' };
const TILE_COLOURS: PlayColour[] = ['sky', 'sun', 'grass', 'grape', 'coral'];
const AGE_COLOURS: PlayColour[] = ['coral', 'sun', 'sky', 'grape'];
/** Still bits of confetti along the edges of the page. */
const CONFETTI = [
  { icon: '⭐', left: 2, top: 30, size: 22, turn: -12 },
  { icon: '🎈', left: 92, top: 120, size: 28, turn: 10 },
  { icon: '✨', left: 4, top: 300, size: 20, turn: 0 },
  { icon: '🌈', left: 90, top: 420, size: 26, turn: -8 },
  { icon: '🧩', left: 3, top: 560, size: 22, turn: 14 },
  { icon: '⭐', left: 93, top: 700, size: 20, turn: 18 },
];

export default function StartScreen({ onStart, loading, error, savedChildren, onViewHistory, onDeleteChild, onChangeAvatar }: StartScreenProps) {
  const onHeaderScroll = useAppHeaderScroll();
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
    AsyncStorage.getItem(CONSENT_KEY).then(saved => { if (saved === '1') setConsent(true); }).catch(() => {});
  }, []);
  function changeConsent(on: boolean) {
    setConsent(on);
    (on ? AsyncStorage.setItem(CONSENT_KEY, '1') : AsyncStorage.removeItem(CONSENT_KEY)).catch(() => {});
  }
  function closeAbout() {
    setAboutOpen(false);
    AsyncStorage.setItem(ABOUT_SEEN_KEY, '1').catch(() => {});
  }

  const showNewForm = adding || savedChildren.length === 0;
  const selected = showNewForm ? undefined : savedChildren.find(c => c.nickname.trim().toLowerCase() === firstName.trim().toLowerCase());
  const needsAge = showNewForm || (selected !== undefined && selected.age === null);
  const canStart = consent && !loading && (showNewForm || selected !== undefined);
  const { width, height } = useWindowDimensions();
  const wide = width >= 640;
  const columns = width >= 640 ? 4 : width >= 440 ? 3 : 2;
  // Owl's stage: smaller on short phones so the players stay near the top.
  const stageWidth = wide ? 300 : height < 700 ? 190 : Math.min(240, width - spacing(8));

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
    // Once a grown-up has agreed on this device, one tap on a player starts.
    if (consent && !loading && child.age !== null) onStart({ firstName: child.nickname, age: child.age });
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
    <View style={styles.screen}>
      {/* Still confetti along the sides (no motion here, so nothing distracts while choosing). */}
      <View style={styles.confetti} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {CONFETTI.map((c, i) => <Text key={i} style={[styles.confettiBit, { left: `${c.left}%`, top: c.top, fontSize: c.size, transform: [{ rotate: `${c.turn}deg` }] }]}>{c.icon}</Text>)}
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" onScroll={onHeaderScroll} scrollEventThrottle={16}>
        {/* Hello from Owl */}
        <View style={[styles.hero, wide && styles.heroWide]}>
          <OwlStage still width={stageWidth} owlSize={Math.round(stageWidth * 0.3)} tint="grape" bubble={showNewForm ? 'New friend! 🎉' : 'Hi there! 👋'} />
          <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
            <Text style={[styles.eyebrow, wide && styles.leftText]}>{showNewForm ? '✨ NEW PLAYER ✨' : '✨ PICK YOUR PLAYER ✨'}</Text>
            <Text accessibilityRole="header" style={[styles.helloTitle, wide && styles.leftText, wide && styles.helloTitleWide]}>Who’s playing today?</Text>
            <Text style={[styles.helloHint, wide && styles.leftText]}>{showNewForm ? 'Add a player to start' : 'Tap a player to start'}</Text>
          </View>
          <Pressable onPress={() => setAboutOpen(true)} accessibilityRole="button" accessibilityLabel="About KidCog" hitSlop={8} style={({ pressed }) => [styles.infoButton, pressed && styles.infoPressed]}>
            <Text style={styles.infoText}>i</Text>
          </Pressable>
        </View>

        {!showNewForm ? (
          <View style={styles.tiles}>
            {savedChildren.map((saved, index) => {
              const on = selected?.id === saved.id;
              const c = PLAY[TILE_COLOURS[index % TILE_COLOURS.length]!];
              const stars = progressById[saved.id]?.stars ?? 0;
              return (
                <View key={saved.id} style={[styles.tileWrap, { width: `${100 / columns}%` }]}>
                  <Pressable
                    onPress={() => chooseSaved(saved)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${saved.nickname}${saved.age !== null ? `, age ${saved.age}` : ''}`}
                    style={({ pressed }) => [styles.tile, { backgroundColor: c.soft, borderColor: c.face }, on && styles.tileOn, pressed && styles.tilePressed]}
                  >
                    <View style={[styles.avatarBubble, { borderColor: c.face }]}>
                      <Text style={styles.tileAvatar}>{avatarEmoji(saved.avatar, index)}</Text>
                    </View>
                    <Text style={styles.tileName} numberOfLines={1}>{saved.nickname}</Text>
                    <View style={styles.pills}>
                      {saved.age !== null ? <View style={[styles.agePill, { backgroundColor: c.face, borderColor: c.lip }]}><Text style={[styles.agePillText, { color: c.text }]}>Age {saved.age}</Text></View> : null}
                      {stars > 0 ? <View style={styles.starPill}><Text style={styles.starPillText}>⭐ {stars}</Text></View> : null}
                    </View>
                    {on ? <View style={styles.tileCheck}><Text style={styles.tileCheckText}>✓</Text></View> : null}
                  </Pressable>
                  <Pressable
                    onPress={() => setActionsFor(saved)}
                    accessibilityRole="button"
                    accessibilityLabel={`More options for ${saved.nickname}`}
                    hitSlop={6}
                    style={({ pressed }) => [styles.moreButton, pressed && styles.infoPressed]}
                  >
                    <Text style={styles.moreText}>{deletingId === saved.id ? '⏳' : '⋯'}</Text>
                  </Pressable>
                </View>
              );
            })}
            <View style={[styles.tileWrap, { width: `${100 / columns}%` }]}>
              <Pressable onPress={startAdding} accessibilityRole="button" accessibilityLabel="Add a child" style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.tilePressed]}>
                <View style={styles.addCircle}><Text style={styles.addPlus}>+</Text></View>
                <Text style={styles.addText}>Add a child</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.newCard}>
            <Ribbon text="🌟 NEW PLAYER" colour="sun" />
            <View style={styles.newTop}>
              <View style={styles.previewCircle} accessibilityLabel={`Picture: ${avatarName(avatar)}`}>
                <Text style={styles.previewEmoji}>{avatarEmoji(avatar)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>✏️  Nickname</Text>
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
            <Text style={[styles.label, { marginTop: spacing(2) }]}>🎨  Pick a picture</Text>
            <AvatarQuickPick selected={avatar} onPick={setAvatar} />
          </View>
        )}

        {needsAge ? (
          <View>
            <Text style={styles.label}>🎂  How old?</Text>
            <View style={styles.chips}>
              {AGES.map((a, i) => {
                const on = age === a;
                const c = PLAY[AGE_COLOURS[i]!];
                return (
                  <Pressable
                    key={a}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`Age ${a}`}
                    onPress={() => setAge(a)}
                    style={({ pressed }) => [styles.chip, { borderColor: c.face }, on && { backgroundColor: c.face, borderColor: c.lip }, on && styles.chipOn, pressed && styles.tilePressed]}
                  >
                    <Text style={styles.ageIcon}>{AGE_ICONS[a]}</Text>
                    <Text style={[styles.chipText, { color: on ? c.text : c.lip }]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {showNewForm && savedChildren.length > 0 ? (
          <Pressable onPress={() => setAdding(false)} accessibilityRole="button" style={({ pressed }) => [styles.backLink, pressed && styles.infoPressed]}>
            <Text style={styles.backLinkText}>← Back to saved players</Text>
          </Pressable>
        ) : null}

        <View style={styles.consentRow}>
          <View style={styles.grownUpTag}><Text style={styles.grownUpTagText}>👪 FOR GROWN-UPS</Text></View>
          <View style={styles.consentInner}>
            <Switch value={consent} onValueChange={changeConsent} trackColor={{ true: PLAY.grass.face, false: colors.line }} accessibilityLabel="I'm the parent or guardian and agree to how KidCog checks answers" />
            <Text style={styles.consentText}>
              I’m the parent or guardian and agree to how KidCog checks answers.{' '}
              <Text style={styles.learnMore} onPress={() => setAboutOpen(true)} accessibilityRole="link">Learn more</Text>
            </Text>
          </View>
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <ChunkyButton
          title={loading ? 'Getting ready…' : 'Choose an adventure →'}
          onPress={handleStart}
          disabled={!canStart}
          loading={loading}
          style={styles.go}
        />
        <Text style={styles.parade} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🦁 🐘 🐧 🦋 🐸 🚀</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8EF' },
  scrollArea: { flex: 1 },
  container: { padding: GUTTER, paddingBottom: spacing(6), ...column, gap: spacing(2.5) },
  confetti: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  confettiBit: { position: 'absolute', opacity: 0.45 },
  leftText: { textAlign: 'left' },

  hero: { alignItems: 'center', backgroundColor: '#F3EEFF', borderRadius: 30, borderWidth: 3, borderBottomWidth: 8, borderColor: '#B9A3EC', paddingTop: spacing(1.5), paddingBottom: spacing(2), paddingHorizontal: spacing(2) },
  heroWide: { flexDirection: 'row', justifyContent: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  heroCopy: { alignItems: 'center', marginTop: spacing(0.5) },
  heroCopyWide: { alignItems: 'flex-start', flexShrink: 1 },
  eyebrow: { fontSize: 13, letterSpacing: 1.4, fontWeight: '900', color: PLAY.coral.face, textAlign: 'center' },
  helloTitle: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: '#5D439B', textAlign: 'center', marginTop: 2 },
  helloTitleWide: { fontSize: 38, lineHeight: 44 },
  helloHint: { fontSize: 17, fontWeight: '700', color: '#6D5B91', marginTop: 4, textAlign: 'center' },
  infoButton: { position: 'absolute', top: spacing(1.25), right: spacing(1.25), width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 4, borderColor: '#B9A3EC', alignItems: 'center', justifyContent: 'center' },
  infoPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
  infoText: { fontSize: 20, color: '#5D439B', fontWeight: '900', fontStyle: 'italic' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.75) },
  tileWrap: { padding: spacing(0.75), maxWidth: 240 },
  tile: { minHeight: 170, borderRadius: 26, borderWidth: 3, borderBottomWidth: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(1), paddingVertical: spacing(1.5) },
  tileOn: { borderWidth: 4, borderBottomWidth: 9, borderColor: PLAY.coral.face, transform: [{ scale: 1.03 }] },
  tilePressed: { transform: [{ scale: 0.95 }] },
  avatarBubble: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  tileAvatar: { fontSize: 46 },
  tileName: { fontSize: 20, fontWeight: '900', color: '#3F3126', marginTop: spacing(0.75), maxWidth: '100%' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, marginTop: 5 },
  agePill: { borderRadius: 999, borderBottomWidth: 3, paddingHorizontal: 10, paddingVertical: 3 },
  agePillText: { fontSize: 13, fontWeight: '900' },
  starPill: { borderRadius: 999, backgroundColor: '#FFF4D2', borderWidth: 2, borderColor: '#FFC83D', paddingHorizontal: 9, paddingVertical: 2 },
  starPillText: { fontSize: 13, fontWeight: '900', color: '#7A4E08' },
  tileCheck: { position: 'absolute', left: 10, top: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: PLAY.grass.face, borderBottomWidth: 3, borderColor: PLAY.grass.lip, alignItems: 'center', justifyContent: 'center' },
  tileCheckText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  moreButton: { position: 'absolute', right: spacing(1.75), top: spacing(1.75), width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 2, borderBottomWidth: 3, borderColor: '#DDD3C6', alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 18, fontWeight: '900', color: '#6F655D', marginTop: -4 },
  addTile: { backgroundColor: '#FFFFFF', borderColor: '#F3B7A9', borderStyle: 'dashed', borderBottomWidth: 3 },
  addCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: PLAY.coral.face, borderBottomWidth: 5, borderColor: PLAY.coral.lip, alignItems: 'center', justifyContent: 'center' },
  addPlus: { fontSize: 40, lineHeight: 44, color: '#FFFFFF', fontWeight: '900' },
  addText: { fontSize: 17, fontWeight: '900', color: PLAY.coral.lip, marginTop: spacing(1) },

  newTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  previewCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFF4D2', borderWidth: 3, borderBottomWidth: 6, borderColor: '#FFC83D', alignItems: 'center', justifyContent: 'center' },
  previewEmoji: { fontSize: 48 },
  newCard: { backgroundColor: '#FFFFFF', borderWidth: 3, borderBottomWidth: 8, borderColor: '#FFC83D', borderRadius: 28, padding: spacing(2), paddingTop: spacing(3.5), marginTop: spacing(1) },
  label: { fontSize: 16, fontWeight: '900', color: '#5D439B', marginBottom: spacing(1) },
  input: { backgroundColor: '#FFFDF8', borderWidth: 2.5, borderColor: '#E8D5BA', borderRadius: 18, paddingHorizontal: spacing(2), paddingVertical: spacing(1.75), fontSize: 19, fontWeight: '700', color: colors.ink },
  chips: { flexDirection: 'row', gap: spacing(1) },
  chip: { flex: 1, height: 84, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 3, borderBottomWidth: 6, alignItems: 'center', justifyContent: 'center' },
  chipOn: { transform: [{ translateY: -3 }] },
  ageIcon: { fontSize: 28 },
  chipText: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  backLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(1.75), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 4, borderColor: '#F3D9C9' },
  backLinkText: { color: colors.primary, fontWeight: '900', fontSize: 15 },

  consentRow: { backgroundColor: '#EAF7EF', borderRadius: 22, borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#8FD0A8', paddingVertical: spacing(1.25), paddingHorizontal: spacing(1.5), marginTop: spacing(1) },
  grownUpTag: { position: 'absolute', top: -13, left: spacing(2), backgroundColor: PLAY.grass.face, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  grownUpTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  consentInner: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), marginTop: 4 },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#2B6A45', fontWeight: '700' },
  learnMore: { color: '#1D57A6', fontWeight: '900', textDecorationLine: 'underline' },
  errorBanner: { backgroundColor: '#FBE9E7', color: colors.danger, padding: spacing(2), borderRadius: 12, fontSize: 15 },
  go: { minHeight: 68 },
  parade: { fontSize: 22, letterSpacing: 3, textAlign: 'center', opacity: 0.85, marginTop: -spacing(1) },

  sheetCount: { fontSize: 15, fontWeight: '900', color: colors.inkSoft },
  bookSub: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.inkSoft, marginTop: -spacing(1), marginBottom: spacing(1.5) },
  bookGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingBottom: spacing(1) },
  bookSlot: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#F3EEE7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E8DFD2', borderStyle: 'dashed' },
  bookSlotOwned: { backgroundColor: colors.happySoft, borderColor: colors.happy, borderStyle: 'solid' },
  bookEmoji: { fontSize: 30 },
  bookEmojiLocked: { fontSize: 18, fontWeight: '900', color: '#C9BBA7' },
  bookHint: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginTop: spacing(1) },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#513A27', textAlign: 'center', marginBottom: spacing(1.5) },
  sheetAction: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), minHeight: 58, paddingHorizontal: spacing(1.5), borderRadius: 16 },
  sheetActionPressed: { backgroundColor: colors.bg },
  sheetIcon: { fontSize: 24 },
  sheetActionText: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink },
  sheetChevron: { fontSize: 26, color: colors.inkSoft },
  sheetCancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1), borderRadius: 16, backgroundColor: colors.bg },
  sheetCancelText: { fontSize: 16, fontWeight: '800', color: colors.inkSoft },
});

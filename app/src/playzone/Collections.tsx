import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Owl from '../components/Owl';
import Sheet from '../components/Sheet';
import { OWL_ITEMS, OWL_SLOTS, isUnlocked, nextUnlock, type OwlItem } from '../components/owlOutfits';
import { AVATARS } from '../avatars';
import { playSound } from '../games/sounds';
import type { ChildProgress, OwlOutfit } from '../progress';
import { colors, spacing } from '../theme';
import { PictureArt } from './dotArt';
import { DOT_PICTURES } from './dotPictures';

/**
 * The child's own things, at the top of the Play Zone: the sticker book, the
 * wall of pictures they have finished (and coloured), and Owl's dress-up box.
 * Every game they finish adds to one of these.
 */
const PICTURES = Object.values(DOT_PICTURES);

export default function CollectionShelf({ progress, childName, onOutfit }: {
  progress: ChildProgress | null;
  childName?: string;
  onOutfit: (outfit: OwlOutfit) => void;
}) {
  const [open, setOpen] = useState<'stickers' | 'pictures' | 'owl' | null>(null);
  // Each panel scrolls as a whole, so it fits short screens (a phone on its side).
  const { height } = useWindowDimensions();
  const bodyMax = Math.max(160, height * 0.88 - 140);
  const stickers = progress?.stickers ?? [];
  const wall = progress?.pictures ?? {};
  const finished = PICTURES.filter(p => wall[p.key]);
  const stars = progress?.stars ?? 0;
  const outfit = progress?.owl ?? {};
  const upcoming = nextUnlock(stars);
  const close = () => setOpen(null);
  const whose = childName ? `${childName}’s` : 'My';

  return (
    <>
      <View style={styles.shelf}>
        <Tile onPress={() => setOpen('stickers')} label={`Sticker book, ${stickers.length} of ${AVATARS.length}`} color="#FEF3DC" border="#F2B441">
          <Text style={styles.tileIcon}>📒</Text>
          <Text style={styles.tileTitle}>Stickers</Text>
          <Text style={styles.tileCount}>{stickers.length}/{AVATARS.length}</Text>
        </Tile>
        <Tile onPress={() => setOpen('pictures')} label={`My pictures, ${finished.length} of ${PICTURES.length}`} color="#E3F1FB" border="#5B9BD0">
          <Text style={styles.tileIcon}>🖼️</Text>
          <Text style={styles.tileTitle}>My pictures</Text>
          <Text style={styles.tileCount}>{finished.length}/{PICTURES.length}</Text>
        </Tile>
        <Tile onPress={() => setOpen('owl')} label="Dress up Owl" color="#EEE9FF" border="#A68AE2">
          <Owl size={38} />
          <Text style={styles.tileTitle}>Dress up Owl</Text>
          <Text style={styles.tileCount} numberOfLines={1}>{upcoming ? `${upcoming.emoji} at ⭐${upcoming.stars}` : 'All unlocked!'}</Text>
        </Tile>
      </View>

      {/* Only the open sheet is mounted, so its content (and Close button) is the only one on the page. */}
      {open === 'stickers' ? <Sheet visible onClose={close} closeLabel="Close sticker book">
        <ScrollView style={{ maxHeight: bodyMax }} contentContainerStyle={{ paddingBottom: 4 }}>
        <Text style={styles.sheetTitle}>{whose} stickers</Text>
        <Text style={styles.sheetSub}>{stickers.length} of {AVATARS.length} collected</Text>
        <View style={styles.grid}>
          {AVATARS.map(a => {
            const owned = stickers.includes(a.key);
            return (
              <View key={a.key} style={[styles.slot, owned && styles.slotOwned]} accessibilityLabel={owned ? a.name : 'Not collected yet'}>
                <Text style={owned ? styles.slotEmoji : styles.slotLocked}>{owned ? a.emoji : '?'}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.hint}>Finish a thinking activity to win a new sticker!</Text>
        </ScrollView>
        <CloseButton onPress={close} />
      </Sheet> : null}

      {open === 'pictures' ? <Sheet visible onClose={close} closeLabel="Close my pictures">
        <ScrollView style={{ maxHeight: bodyMax }} contentContainerStyle={{ paddingBottom: 4 }}>
        <Text style={styles.sheetTitle}>{whose} pictures</Text>
        <Text style={styles.sheetSub}>{finished.length} of {PICTURES.length} on the wall</Text>
        <View style={styles.grid}>
          {PICTURES.map(p => {
            const done = Boolean(wall[p.key]);
            return (
              <View key={p.key} style={[styles.frame, done && styles.frameDone]} accessibilityLabel={done ? `Your ${p.name.toLowerCase()}` : 'A picture still to find'}>
                {done ? <PictureArt picture={p} colours={wall[p.key]} size={78} /> : <Text style={styles.frameLocked}>?</Text>}
                <Text style={styles.frameName}>{done ? p.name : '…'}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.hint}>Play Connect the Dots to find more, and tap 🎨 to colour them your way!</Text>
        </ScrollView>
        <CloseButton onPress={close} />
      </Sheet> : null}

      {open === 'owl' ? <Sheet visible onClose={close} closeLabel="Close dress up">
        <ScrollView style={{ maxHeight: bodyMax }} contentContainerStyle={{ paddingBottom: 4 }}>
        <Text style={styles.sheetTitle}>Dress up Owl</Text>
        <View style={styles.preview}><Owl mood="happy" size={120} outfit={outfit} /></View>
        <Text style={styles.sheetSub}>
          ⭐ {stars} stars{upcoming ? ` · ${upcoming.stars - stars} more for the ${upcoming.name.toLowerCase()} ${upcoming.emoji}` : ' · everything unlocked!'}
        </Text>
        <View>
          {OWL_SLOTS.map(({ slot, title }) => (
            <View key={slot} style={styles.slotRow}>
              <Text style={styles.slotTitle}>{title}</Text>
              <View style={styles.items}>
                {OWL_ITEMS.filter(i => i.slot === slot).map(item => (
                  <ItemButton key={item.key} item={item} stars={stars} wearing={outfit[slot] === item.key}
                    onPress={() => {
                      if (!isUnlocked(item, stars)) { playSound('oops'); return; }
                      playSound('pop');
                      onOutfit({ ...outfit, [slot]: outfit[slot] === item.key ? undefined : item.key });
                    }} />
                ))}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.hint}>Stars from games and activities unlock new things. You keep them all!</Text>
        </ScrollView>
        <CloseButton onPress={close} />
      </Sheet> : null}
    </>
  );
}

function Tile({ children, onPress, label, color, border }: { children: React.ReactNode; onPress: () => void; label: string; color: string; border: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { backgroundColor: color, borderColor: border }, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

function ItemButton({ item, stars, wearing, onPress }: { item: OwlItem; stars: number; wearing: boolean; onPress: () => void }) {
  const open = isUnlocked(item, stars);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: wearing, disabled: !open }}
      accessibilityLabel={open ? `${item.name}${wearing ? ', wearing' : ''}` : `${item.name}, unlocks at ${item.stars} stars`}
      style={({ pressed }) => [styles.item, wearing && styles.itemOn, !open && styles.itemLocked, pressed && styles.pressed]}>
      <Text style={[styles.itemEmoji, !open && { opacity: 0.35 }]}>{item.emoji}</Text>
      <Text style={styles.itemName} numberOfLines={1}>{open ? item.name : `🔒 ⭐${item.stars}`}</Text>
    </Pressable>
  );
}

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
      <Text style={styles.closeText}>Close</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shelf: { flexDirection: 'row', gap: spacing(1) },
  tile: { flex: 1, minHeight: 104, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(1), paddingHorizontal: 4, gap: 2 },
  tileIcon: { fontSize: 30 },
  tileTitle: { fontSize: 13, fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  tileCount: { fontSize: 12, fontWeight: '800', color: colors.inkSoft },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#513A27', textAlign: 'center', marginBottom: spacing(0.5) },
  sheetSub: { textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.inkSoft, marginBottom: spacing(1.5) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingBottom: spacing(1) },
  slot: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#F3EEE7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E8DFD2', borderStyle: 'dashed' },
  slotOwned: { backgroundColor: colors.happySoft, borderColor: colors.happy, borderStyle: 'solid' },
  slotEmoji: { fontSize: 30 },
  slotLocked: { fontSize: 18, fontWeight: '900', color: '#C9BBA7' },
  frame: { width: 96, alignItems: 'center', padding: 6, borderRadius: 16, backgroundColor: '#F3EEE7', borderWidth: 2, borderColor: '#E8DFD2', borderStyle: 'dashed' },
  frameDone: { backgroundColor: '#FFFFFF', borderColor: '#C9A46A', borderStyle: 'solid' },
  frameLocked: { width: 78, height: 78, textAlign: 'center', lineHeight: 78, fontSize: 28, fontWeight: '900', color: '#C9BBA7' },
  frameName: { fontSize: 12, fontWeight: '800', color: colors.inkSoft, marginTop: 2 },
  hint: { textAlign: 'center', fontSize: 13, fontWeight: '700', color: colors.inkSoft, marginTop: spacing(1) },
  preview: { alignItems: 'center', marginBottom: spacing(0.5) },
  slotRow: { marginBottom: spacing(1.5) },
  slotTitle: { fontSize: 14, fontWeight: '900', color: '#5D439B', marginBottom: 6 },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: 78, minHeight: 72, borderRadius: 16, borderWidth: 2, borderColor: '#E3DAF7', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', padding: 4 },
  itemOn: { borderColor: '#7650C7', borderWidth: 3, backgroundColor: '#F3EEFF' },
  itemLocked: { backgroundColor: '#F6F3EE', borderColor: '#E8DFD2' },
  itemEmoji: { fontSize: 28 },
  itemName: { fontSize: 11, fontWeight: '800', color: colors.inkSoft, marginTop: 2 },
  close: { alignSelf: 'center', marginTop: spacing(1.5), minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(3), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line },
  closeText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});

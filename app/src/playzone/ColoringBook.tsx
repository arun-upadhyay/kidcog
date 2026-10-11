import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSound } from '../games/sounds';
import { speak, stopSpeaking } from '../speech';
import { CRAYONS, GROUPS, PAGES, type ColoringPage, type GroupKey } from './coloringPages';
import { useNative, useUsableHeight } from './common';
import { useBackHandler } from '../backHandler';

/**
 * The Coloring Book: pick a picture, pick a crayon, tap a part to colour it.
 * Big crayons (each says its colour when tapped), Undo, Start over, and a
 * "Surprise me!" that colours the whole picture at once. Every picture is
 * saved on this device for the child as they go, and shows its colours on
 * the book's shelf.
 */
type Saved = Record<string, string[]>;
const storeKey = (childId: string) => `kidcog.coloring.v1.${childId}`;

function Picture({ page, fills, size, onPart }: { page: ColoringPage; fills: string[]; size: number; onPart?: (i: number) => void }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {page.parts.map((part, i) => (
        <Path key={i} d={part.d} fill={fills[i] ?? '#FFFFFF'} stroke="#3F3550" strokeWidth={size < 120 ? 1.6 : 1.1} strokeLinejoin="round" onPress={onPart ? () => onPart(i) : undefined} />
      ))}
      {page.lines?.map((d, i) => <Path key={`l${i}`} d={d} fill="none" stroke="#3F3550" strokeWidth={size < 120 ? 1.6 : 1.1} strokeLinecap="round" />)}
      {page.caption && size >= 120 ? <SvgText x={50} y={8} fontSize={6.5} fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" fill="#3F3550" textAnchor="middle">{page.caption}</SvgText> : null}
    </Svg>
  );
}

export default function ColoringBook({ childId }: { childId: string }) {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();
  const [group, setGroup] = useState<GroupKey>('abc');
  const [open, setOpen] = useState<ColoringPage | null>(null);
  useBackHandler(4, () => setOpen(null), open !== null);
  const [saved, setSaved] = useState<Saved>({});
  const [crayon, setCrayon] = useState(0);
  const [history, setHistory] = useState<string[][]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(storeKey(childId)).then(raw => { if (raw) setSaved(JSON.parse(raw) as Saved); }).catch(() => {});
  }, [childId]);
  const save = (next: Saved) => { setSaved(next); AsyncStorage.setItem(storeKey(childId), JSON.stringify(next)).catch(() => {}); };

  const fills = open ? saved[open.key] ?? [] : [];
  const setFills = (next: string[]) => { if (open) { setHistory(h => [...h.slice(-30), fills]); save({ ...saved, [open.key]: next }); } };
  const pop = () => {
    sparkle.setValue(0);
    Animated.timing(sparkle, { toValue: 1, duration: 600, useNativeDriver: useNative }).start();
  };

  function colour(i: number) {
    const next = [...fills]; next[i] = CRAYONS[crayon]!.hex;
    setFills(next); playSound('pop'); setNotice(null);
    if (open && open.parts.every((_, j) => next[j] && next[j] !== '#FFFFFF')) { setNotice('🎉 You coloured it all! Beautiful!'); pop(); playSound('yay'); }
  }
  function surprise() {
    if (!open) return;
    setFills(open.parts.map(() => CRAYONS[Math.floor(Math.random() * 10)]!.hex));
    playSound('whoosh'); setNotice('✨ Ta-da! A surprise picture!'); pop();
  }
  function pickCrayon(i: number) {
    setCrayon(i);
    stopSpeaking(); void speak(CRAYONS[i]!.name, { voice: 'device' });
  }

  if (!open) {
    const pages = PAGES.filter(p => p.group === group);
    const columns = width >= 900 ? 4 : width >= 560 ? 3 : 2;
    const tile = Math.floor(Math.min(220, (Math.min(width, 900) - 48 - (columns - 1) * 12) / columns));
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>🖍️ Pick a picture to colour!</Text>
        <View style={styles.groups}>
          {GROUPS.map(g => (
            <Pressable key={g.key} onPress={() => setGroup(g.key)} accessibilityRole="tab" accessibilityState={{ selected: g.key === group }}
              style={({ pressed }) => [styles.group, g.key === group && styles.groupOn, pressed && styles.pressed]}>
              <Text style={styles.groupEmoji}>{g.emoji}</Text>
              <Text style={[styles.groupText, g.key === group && styles.groupTextOn]}>{g.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.shelf}>
          {pages.map(page => (
            <Pressable key={page.key} onPress={() => { setOpen(page); setHistory([]); setNotice(null); }} accessibilityRole="button" accessibilityLabel={`Colour ${page.name}`}
              style={({ pressed }) => [styles.pageTile, { width: tile }, pressed && styles.pressed]}>
              <View style={styles.pageArt}><Picture page={page} fills={saved[page.key] ?? []} size={tile - 24} /></View>
              <Text style={styles.pageName} numberOfLines={1}>{page.emoji} {page.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  const canvas = Math.floor(Math.max(220, Math.min(width - 48, 560, height - 300)));
  return (
    <View style={styles.panel}>
      <View style={styles.topRow}>
        <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Back to the coloring book" style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
          <Text style={styles.toolText}>📚 Book</Text>
        </Pressable>
        <Text style={styles.pageTitle} numberOfLines={1}>{open.emoji} {open.name}</Text>
      </View>

      <View style={[styles.canvas, { width: canvas + 16, height: canvas + 16 }]} accessibilityLabel={`Colouring ${open.name}`} testID="coloring-canvas">
        <Picture page={open} fills={fills} size={canvas} onPart={colour} />
        <Animated.Text pointerEvents="none" style={[styles.sparkle, { opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }] }]}>✨</Animated.Text>
      </View>

      <View style={styles.crayons} accessibilityRole="radiogroup">
        {CRAYONS.map((c, i) => (
          <Pressable key={c.name} onPress={() => pickCrayon(i)} accessibilityRole="radio" accessibilityLabel={`Crayon ${c.name}`} accessibilityState={{ checked: i === crayon }}
            style={[styles.crayon, { backgroundColor: c.hex }, c.hex === '#FFFFFF' && styles.crayonWhite, i === crayon && styles.crayonOn]}>
            {i === crayon ? <Text style={[styles.crayonTick, c.hex === '#FFFFFF' || c.hex === '#FFD54A' ? { color: '#3F3550' } : null]}>✓</Text> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.tools}>
        <Pressable onPress={() => { const prev = history[history.length - 1]; if (prev && open) { save({ ...saved, [open.key]: prev }); setHistory(h => h.slice(0, -1)); } }}
          disabled={!history.length} accessibilityRole="button" style={({ pressed }) => [styles.tool, !history.length && styles.toolOff, pressed && styles.pressed]}>
          <Text style={styles.toolText}>↶ Undo</Text>
        </Pressable>
        <Pressable onPress={() => { setFills([]); setNotice('A fresh page!'); }} accessibilityRole="button" style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
          <Text style={styles.toolText}>🧽 Start over</Text>
        </Pressable>
        <Pressable onPress={surprise} accessibilityRole="button" style={({ pressed }) => [styles.tool, styles.toolMagic, pressed && styles.pressed]}>
          <Text style={[styles.toolText, { color: '#FFFFFF' }]}>✨ Surprise me!</Text>
        </Pressable>
      </View>
      <Text style={styles.notice} accessibilityLiveRegion="polite">{notice ?? 'Pick a crayon, then tap the picture. Your colours are saved!'}</Text>
    </View>
  );
}

/** Every page by key (for tests). */
export const PAGE_BY_KEY = Object.fromEntries(PAGES.map(p => [p.key, p]));

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 28, padding: 14 },
  title: { fontSize: 22, fontWeight: '900', color: '#53347E', textAlign: 'center' },
  groups: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  group: { alignItems: 'center', minWidth: 74, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#D9CCFA' },
  groupOn: { backgroundColor: '#7650C7', borderColor: '#54369A' },
  groupEmoji: { fontSize: 26 },
  groupText: { fontSize: 13, fontWeight: '900', color: '#53347E' },
  groupTextOn: { color: '#FFFFFF' },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  pageTile: { alignItems: 'center', gap: 6, padding: 10, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 3, borderBottomWidth: 7, borderColor: '#F3B7A9' },
  pageArt: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  pageName: { fontSize: 14, fontWeight: '900', color: '#3F3126', maxWidth: '100%' },
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: '#53347E', textAlign: 'center' },
  canvas: { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 3, borderBottomWidth: 7, borderColor: '#D9CCFA', alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute', fontSize: 120 },
  crayons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, maxWidth: 560 },
  crayon: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  crayonWhite: { borderColor: '#D9CCFA' },
  crayonOn: { borderColor: '#3F3550', borderWidth: 4, transform: [{ scale: 1.15 }] },
  crayonTick: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  tool: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#D9CCFA' },
  toolMagic: { backgroundColor: '#E5533D', borderColor: '#B23A27' },
  toolOff: { opacity: 0.45 },
  toolText: { fontSize: 16, fontWeight: '900', color: '#53347E' },
  notice: { fontSize: 16, fontWeight: '800', color: '#5A4B66', textAlign: 'center' },
  pressed: { transform: [{ scale: 0.95 }] },
});

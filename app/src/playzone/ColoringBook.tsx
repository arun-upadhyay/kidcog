import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Polyline, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSound, useSoundEffects } from '../games/sounds';
import { speak, stopSpeaking } from '../speech';
import { CRAYONS, GROUPS, PAGES, type ColoringPage, type GroupKey } from './coloringPages';
import { drawingTouchStyle, useNative, useScrollLock } from './common';
import DrawingStudio from './DrawingStudio';
export { STUDIO_MAX } from './DrawingStudio';
import { useBackHandler } from '../backHandler';

/**
 * The Coloring Book: pick a picture from the shelf, then colour it in the
 * shared drawing studio (DrawingStudio.tsx): the picture big in the middle,
 * undo / start over / surprise along the top, brush, pencil, marker, bucket
 * and eraser down the side, and crayons that slide out only when needed.
 * Fills and drawings are saved on this device for the child.
 */
type Stroke = { color: string; points: [number, number][]; w?: number; o?: number };
type Saved = Record<string, string[]>;
type Draws = Record<string, Stroke[]>;
type ToolKey = 'brush' | 'pencil' | 'marker' | 'fill' | 'eraser';
const storeKey = (childId: string) => `kidcog.coloring.v1.${childId}`;
const drawKey = (childId: string) => `kidcog.coloring.draw.v1.${childId}`;

/** The tools down the right. Line widths are in the picture's 0–100 units. */
const TOOLS: { key: ToolKey; icon: string; label: string; width?: number; opacity?: number; say: string }[] = [
  { key: 'brush', icon: '🖌️', label: 'Brush', width: 6.5, say: 'Paint brush! Paint big and bold.' },
  { key: 'pencil', icon: '✏️', label: 'Pencil', width: 1.6, say: 'Pencil! Draw thin lines.' },
  { key: 'marker', icon: '🖍️', label: 'Marker', width: 3.6, opacity: 0.85, say: 'Marker!' },
  { key: 'fill', icon: '🪣', label: 'Paint bucket', say: 'Paint bucket! Tap a part to fill it.' },
  { key: 'eraser', icon: '🧽', label: 'Eraser', say: 'Eraser! Rub out lines, or tap a part to make it white again.' },
];
const ERASE_RADIUS = 4;

/** HSL → #rrggbb, so the rainbow picker can offer a whole spectrum of shades. */
function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
// A friendly spectrum: several hues across four shades, plus a row of greys and
// black-to-white — enough to mix almost any colour by tapping, no sliders.
const PICKER_HUES = [0, 18, 38, 52, 128, 155, 188, 210, 255, 285, 318, 340];
const PICKER_COLORS: string[] = [
  ...[84, 66, 50, 36].flatMap(l => PICKER_HUES.map(h => hsl(h, 74, l))),
  ...[97, 80, 62, 45, 28, 10].map(l => hsl(0, 0, l)),
];

function Picture({ page, fills, strokes, size, onPart, fill }: { page: ColoringPage; fills: string[]; strokes?: Stroke[]; size: number; onPart?: (i: number) => void; fill?: boolean }) {
  const sw = size < 120 ? 1.6 : 1.1;
  // `fill` makes the drawing fill its box exactly (open canvas), so rendered
  // parts always match the laid-out size — taps land on the right region even
  // before the box has finished measuring. The shelf tiles use a fixed size.
  return (
    <Svg width={fill ? '100%' : size} height={fill ? '100%' : size} viewBox="0 0 100 100">
      {page.parts.map((part, i) => (
        <Path key={i} d={part.d} fill={fills[i] ?? '#FFFFFF'} stroke="#3F3550" strokeWidth={sw} strokeLinejoin="round" onPress={onPart ? () => onPart(i) : undefined} />
      ))}
      {strokes?.map((s, i) => <Polyline key={`s${i}`} points={s.points.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={s.w ?? 3.6} strokeOpacity={s.o ?? 1} strokeLinecap="round" strokeLinejoin="round" />)}
      {page.lines?.map((d, i) => <Path key={`l${i}`} d={d} fill="none" stroke="#3F3550" strokeWidth={sw} strokeLinecap="round" />)}
      {page.caption && size >= 120 ? <SvgText x={50} y={8} fontSize={6.5} fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" fill="#3F3550" textAnchor="middle">{page.caption}</SvgText> : null}
    </Svg>
  );
}

export default function ColoringBook({ childId, onStudio }: { childId: string; /** A picture opened or closed, so the page around can give the studio the whole screen. */ onStudio?: (open: boolean) => void }) {
  const { width } = useWindowDimensions();
  const lock = useScrollLock();
  const sounds = useSoundEffects();
  const [group, setGroup] = useState<GroupKey>('people');
  const [open, setOpen] = useState<ColoringPage | null>(null);
  useBackHandler(4, () => setOpen(null), open !== null);
  useEffect(() => { onStudio?.(open !== null); }, [open, onStudio]);
  useEffect(() => () => onStudio?.(false), [onStudio]);
  const [saved, setSaved] = useState<Saved>({});
  const [draws, setDraws] = useState<Draws>({});
  const [crayon, setCrayon] = useState(0);
  const [custom, setCustom] = useState<string | null>(null); // a colour mixed from the rainbow picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tool, setTool] = useState<ToolKey>('fill');
  // One undo stack for everything: the fills and drawings just before each change.
  const [history, setHistory] = useState<{ fills: string[]; strokes: Stroke[] }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const sparkle = useRef(new Animated.Value(0)).current;
  // The colour in hand: a preset crayon, or the picked custom colour (index === CRAYONS.length).
  const activeHex = crayon === CRAYONS.length ? (custom ?? CRAYONS[0]!.hex) : CRAYONS[crayon]!.hex;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; lock(false); stopSpeaking(); }; }, [lock]);

  useEffect(() => {
    AsyncStorage.getItem(storeKey(childId)).then(raw => { if (raw) setSaved(JSON.parse(raw) as Saved); }).catch(() => {});
    AsyncStorage.getItem(drawKey(childId)).then(raw => { if (raw) setDraws(JSON.parse(raw) as Draws); }).catch(() => {});
  }, [childId]);
  const save = (next: Saved) => { setSaved(next); AsyncStorage.setItem(storeKey(childId), JSON.stringify(next)).catch(() => {}); };
  const saveDraws = (next: Draws) => { setDraws(next); AsyncStorage.setItem(drawKey(childId), JSON.stringify(next)).catch(() => {}); };

  // A short spoken "how to" when a picture opens: the clear AI voice, falling
  // back to the device voice only if the server can't be reached. Sound-gated.
  useEffect(() => {
    if (!open || !sounds) return;
    const t = setTimeout(() => void speak('Pick a colour from the crayons, then tap a part to fill it, or choose a brush to paint!', { allowDeviceFallback: true }), 450);
    return () => { clearTimeout(t); stopSpeaking(); };
  }, [open?.key, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Short messages (all coloured in, surprise, fresh page) float over the picture for a moment.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => { if (live.current) setNotice(null); }, 2600);
    return () => clearTimeout(t);
  }, [notice]);

  const fills = open ? saved[open.key] ?? [] : [];
  const strokes = open ? draws[open.key] ?? [] : [];
  const remember = () => setHistory(h => [...h.slice(-30), { fills, strokes }]);
  const setFills = (next: string[]) => { if (open) { remember(); save({ ...saved, [open.key]: next }); } };
  const pop = () => { sparkle.setValue(0); Animated.timing(sparkle, { toValue: 1, duration: 600, useNativeDriver: useNative }).start(); };

  function tapPart(i: number) {
    if (tool === 'eraser') {
      if (!fills[i] || fills[i] === '#FFFFFF') return;
      const next = [...fills]; next[i] = '#FFFFFF';
      setFills(next); playSound('whoosh');
      return;
    }
    const next = [...fills]; next[i] = activeHex;
    setFills(next); playSound('pop');
    if (open && open.parts.every((_, j) => next[j] && next[j] !== '#FFFFFF')) { setNotice('🎉 You coloured it all! Beautiful!'); pop(); playSound('yay'); }
  }
  function surprise() {
    if (!open) return;
    setFills(open.parts.map(() => CRAYONS[Math.floor(Math.random() * 10)]!.hex));
    playSound('whoosh'); setNotice('✨ Ta-da! A surprise picture!'); pop();
  }
  function chooseTool(key: ToolKey) {
    const info = TOOLS.find(t => t.key === key)!;
    setTool(key); playSound('pop');
    stopSpeaking(); if (sounds) void speak(info.say, { allowDeviceFallback: true });
  }
  function pickCrayon(i: number) {
    setCrayon(i); playSound('pop');
    if (tool === 'eraser') setTool('fill');
    stopSpeaking(); void speak(CRAYONS[i]!.name, { allowDeviceFallback: true });
  }
  // The rainbow picker: tapping a shade makes it the colour in hand.
  function choosePicked(hex: string) { setCustom(hex); setCrayon(CRAYONS.length); setPickerOpen(false); playSound('pop'); if (tool === 'eraser') setTool('fill'); }

  // Drawing and erasing: drags on the picture.
  const canvasSize = useRef(300);
  const at = (e: GestureResponderEvent): [number, number] => [
    Math.max(0, Math.min(100, (e.nativeEvent.locationX / canvasSize.current) * 100)),
    Math.max(0, Math.min(100, (e.nativeEvent.locationY / canvasSize.current) * 100)),
  ];
  const erased = useRef(false);
  const drawing = tool === 'brush' || tool === 'pencil' || tool === 'marker';
  const eraseAt = (p: [number, number], list: Stroke[]) => list.filter(s => !s.points.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) <= ERASE_RADIUS + (s.w ?? 3.6) / 2));
  function beginStroke(e: GestureResponderEvent) {
    if (!open) return;
    lock(true);
    const p = at(e);
    if (tool === 'eraser') {
      erased.current = false;
      const kept = eraseAt(p, strokes);
      if (kept.length !== strokes.length) { remember(); erased.current = true; saveDraws({ ...draws, [open.key]: kept }); }
      return;
    }
    const info = TOOLS.find(t => t.key === tool)!;
    remember();
    saveDraws({ ...draws, [open.key]: [...strokes, { color: activeHex, w: info.width, o: info.opacity, points: [p, [p[0] + 0.1, p[1] + 0.1]] }] });
  }
  function moveStroke(e: GestureResponderEvent) {
    if (!open) return;
    const p = at(e);
    if (tool === 'eraser') {
      const kept = eraseAt(p, strokes);
      if (kept.length === strokes.length) return;
      // One undo step per rub: remember the drawing the first time this rub removes a line.
      if (!erased.current) { remember(); erased.current = true; }
      saveDraws({ ...draws, [open.key]: kept });
      return;
    }
    const last = strokes[strokes.length - 1];
    if (!last || last.points.length > 400) return;
    saveDraws({ ...draws, [open.key]: [...strokes.slice(0, -1), { ...last, points: [...last.points, p] }] });
  }
  function undo() {
    if (!open) return;
    const prev = history[history.length - 1];
    if (!prev) return;
    save({ ...saved, [open.key]: prev.fills });
    saveDraws({ ...draws, [open.key]: prev.strokes });
    setHistory(h => h.slice(0, -1));
    playSound('flip');
  }
  function startOver() {
    if (!open || (!fills.length && !strokes.length)) return;
    remember();
    save({ ...saved, [open.key]: [] }); saveDraws({ ...draws, [open.key]: [] }); setNotice('A fresh page!');
  }
  function done() { playSound('yay'); setOpen(null); }

  if (!open) {
    const pages = PAGES.filter(p => p.group === group);
    const columns = width >= 900 ? 4 : width >= 560 ? 3 : 2;
    const tile = Math.floor(Math.min(220, (Math.min(width, 900) - 48 - (columns - 1) * 12) / columns));
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>🖍️ Pick a picture to colour!</Text>
        <Text style={styles.subtitle}>Tap a picture, then fill it in with colours or paint with the brushes 🖌️</Text>
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
            <Pressable key={page.key} onPress={() => { setOpen(page); setHistory([]); setNotice(null); setTool('fill'); }} accessibilityRole="button" accessibilityLabel={`Colour ${page.name}`}
              style={({ pressed }) => [styles.pageTile, { width: tile }, pressed && styles.pressed]}>
              <View style={styles.pageArt}><Picture page={page} fills={saved[page.key] ?? []} strokes={draws[page.key]} size={tile - 24} /></View>
              <Text style={styles.pageName} numberOfLines={1}>{page.emoji} {page.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // ── The studio: the shared drawing layout (DrawingStudio) with this book's tools.
  return (
    <DrawingStudio
      testID="coloring-studio"
      closeLabel="Back to the coloring book"
      onClose={() => setOpen(null)}
      actions={[
        { key: 'undo', icon: '↶', label: 'Undo', onPress: undo, disabled: !history.length },
        { key: 'clear', icon: '🗑️', label: 'Start over', onPress: startOver, disabled: !fills.length && !strokes.length },
        { key: 'surprise', icon: '✨', label: 'Surprise me!', onPress: surprise, tone: 'magic' },
      ]}
      done={{ label: 'Done', onPress: done }}
      tools={TOOLS.map(t => ({ key: t.key, icon: t.icon, label: t.label, usesColour: t.key !== 'eraser' }))}
      tool={tool}
      onTool={key => chooseTool(key as ToolKey)}
      colours={CRAYONS.map(c => ({ key: c.name, hex: c.hex, label: `Crayon ${c.name}` }))}
      colour={crayon}
      onColour={pickCrayon}
      more={{ hex: custom, onPress: () => setPickerOpen(true) }}
      notice={notice}
      renderCanvas={size => {
        canvasSize.current = size;
        return (
          <View
            style={[{ width: size, height: size, overflow: 'hidden' }, drawingTouchStyle]}
            accessibilityLabel={`Colouring ${open.name}`}
            testID="coloring-canvas"
            onStartShouldSetResponder={() => drawing}
            onMoveShouldSetResponder={() => drawing || tool === 'eraser'}
            onResponderGrant={beginStroke}
            onResponderMove={moveStroke}
            onResponderRelease={() => lock(false)}
            onResponderTerminate={() => lock(false)}
            onResponderTerminationRequest={() => false}
          >
            <Picture page={open} fills={fills} strokes={strokes} size={size} fill onPart={tool === 'fill' || tool === 'eraser' ? tapPart : undefined} />
            <Animated.Text pointerEvents="none" style={[styles.sparkle, { opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }] }]}>✨</Animated.Text>
          </View>
        );
      }}
      overlay={pickerOpen ? (
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close colour picker" onPress={() => setPickerOpen(false)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>🌈 Pick any colour</Text>
            <View style={styles.pickerGrid}>
              {PICKER_COLORS.map((hex, i) => (
                <Pressable key={i} onPress={() => choosePicked(hex)} accessibilityRole="button" accessibilityLabel={`Colour ${hex}`}
                  style={({ pressed }) => [styles.pickerSwatch, { backgroundColor: hex }, hex.toLowerCase() === '#ffffff' && styles.swatchWhite, pressed && styles.pressed]} />
              ))}
            </View>
            <Pressable onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]}>
              <Text style={styles.pickerCloseText}>✓ Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    />
  );
}

/** Every page by key (for tests). */
export const PAGE_BY_KEY = Object.fromEntries(PAGES.map(p => [p.key, p]));

const styles = StyleSheet.create({
  panel: { alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 28, padding: 14 },
  title: { fontSize: 22, fontWeight: '900', color: '#53347E', textAlign: 'center' },
  subtitle: { fontSize: 15, fontWeight: '700', color: '#6A58A0', textAlign: 'center', marginTop: -6 },
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

  sparkle: { position: 'absolute', fontSize: 120, alignSelf: 'center', top: '30%' },
  swatchWhite: { borderColor: '#B9A3EC' },
  pressed: { transform: [{ scale: 0.95 }] },
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,30,60,0.35)', borderRadius: 28, padding: 16, zIndex: 20 },
  pickerCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 3, borderBottomWidth: 7, borderColor: '#D9CCFA', padding: 16, gap: 12, alignItems: 'center' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#53347E' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pickerSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)' },
  pickerClose: { minWidth: 120, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#2F9A5B', borderBottomWidth: 5, borderBottomColor: '#1F7042' },
  pickerCloseText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
});

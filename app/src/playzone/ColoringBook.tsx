import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Polyline, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSound, useSoundEffects } from '../games/sounds';
import { speak, stopSpeaking } from '../speech';
import { CRAYONS, GROUPS, PAGES, type ColoringPage, type GroupKey } from './coloringPages';
import { useNative, useScrollLock, useUsableHeight } from './common';
import { useBackHandler } from '../backHandler';

/**
 * The Coloring Book: pick a picture, pick a crayon, and either tap a part to
 * fill it (🪣 Fill) or scribble over the picture with the pencil (✏️ Draw).
 * The colours live in a strip down the right of a big canvas, so little hands
 * never scroll to reach them. Owl says what to do when a picture opens. Both
 * the fills and the scribbles are saved on this device for the child.
 */
type Stroke = { color: string; points: [number, number][] };
type Saved = Record<string, string[]>;
type Draws = Record<string, Stroke[]>;
const storeKey = (childId: string) => `kidcog.coloring.v1.${childId}`;
const drawKey = (childId: string) => `kidcog.coloring.draw.v1.${childId}`;

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
      {strokes?.map((s, i) => <Polyline key={`s${i}`} points={s.points.map(p => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />)}
      {page.lines?.map((d, i) => <Path key={`l${i}`} d={d} fill="none" stroke="#3F3550" strokeWidth={sw} strokeLinecap="round" />)}
      {page.caption && size >= 120 ? <SvgText x={50} y={8} fontSize={6.5} fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" fill="#3F3550" textAnchor="middle">{page.caption}</SvgText> : null}
    </Svg>
  );
}

/** A picture button for a tool (kids read the icon, grown-ups the word). */
function Tool({ icon, label, onPress, on, off, danger, done, style }: { icon: string; label: string; onPress: () => void; on?: boolean; off?: boolean; danger?: boolean; done?: boolean; style?: object }) {
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on, disabled: !!off }}
      style={({ pressed }) => [styles.tool, on && styles.toolOn, danger && styles.toolMagic, done && styles.toolDone, off && styles.toolOff, style, pressed && styles.pressed]}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text style={[styles.toolText, (on || danger || done) && { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

export default function ColoringBook({ childId }: { childId: string }) {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();
  const lock = useScrollLock();
  const sounds = useSoundEffects();
  const [group, setGroup] = useState<GroupKey>('people');
  const [open, setOpen] = useState<ColoringPage | null>(null);
  useBackHandler(4, () => setOpen(null), open !== null);
  const [saved, setSaved] = useState<Saved>({});
  const [draws, setDraws] = useState<Draws>({});
  const [crayon, setCrayon] = useState(0);
  const [custom, setCustom] = useState<string | null>(null); // a colour mixed from the rainbow picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mode, setMode] = useState<'fill' | 'draw'>('fill');
  const [history, setHistory] = useState<string[][]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [canvas, setCanvas] = useState(300);
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
    const t = setTimeout(() => void speak('Pick a colour, then tap a part to fill it. Or use the pencil to draw!', { allowDeviceFallback: true }), 450);
    return () => { clearTimeout(t); stopSpeaking(); };
  }, [open?.key, sounds]); // eslint-disable-line react-hooks/exhaustive-deps

  const fills = open ? saved[open.key] ?? [] : [];
  const strokes = open ? draws[open.key] ?? [] : [];
  const setFills = (next: string[]) => { if (open) { setHistory(h => [...h.slice(-30), fills]); save({ ...saved, [open.key]: next }); } };
  const pop = () => { sparkle.setValue(0); Animated.timing(sparkle, { toValue: 1, duration: 600, useNativeDriver: useNative }).start(); };

  function colour(i: number) {
    const next = [...fills]; next[i] = activeHex;
    setFills(next); playSound('pop'); setNotice(null);
    if (open && open.parts.every((_, j) => next[j] && next[j] !== '#FFFFFF')) { setNotice('🎉 You coloured it all! Beautiful!'); pop(); playSound('yay'); }
  }
  function surprise() {
    if (!open) return;
    setFills(open.parts.map(() => CRAYONS[Math.floor(Math.random() * 10)]!.hex));
    playSound('whoosh'); setNotice('✨ Ta-da! A surprise picture!'); pop();
  }
  function pickCrayon(i: number) { setCrayon(i); stopSpeaking(); void speak(CRAYONS[i]!.name, { allowDeviceFallback: true }); }
  // The rainbow picker: tapping a shade makes it the colour in hand.
  function choosePicked(hex: string) { setCustom(hex); setCrayon(CRAYONS.length); setPickerOpen(false); playSound('pop'); }

  // Free scribbling (✏️ Draw): drags become coloured lines over the picture.
  const canvasSize = useRef(canvas);
  const at = (e: GestureResponderEvent): [number, number] => [
    Math.max(0, Math.min(100, (e.nativeEvent.locationX / canvasSize.current) * 100)),
    Math.max(0, Math.min(100, (e.nativeEvent.locationY / canvasSize.current) * 100)),
  ];
  function beginStroke(e: GestureResponderEvent) {
    if (!open) return;
    lock(true);
    const p = at(e);
    saveDraws({ ...draws, [open.key]: [...strokes, { color: activeHex, points: [p, [p[0] + 0.1, p[1] + 0.1]] }] });
    setNotice(null);
  }
  function moveStroke(e: GestureResponderEvent) {
    if (!open) return;
    const p = at(e);
    const last = strokes[strokes.length - 1];
    if (!last || last.points.length > 400) return;
    saveDraws({ ...draws, [open.key]: [...strokes.slice(0, -1), { ...last, points: [...last.points, p] }] });
  }
  function undo() {
    if (!open) return;
    if (mode === 'draw' && strokes.length) { saveDraws({ ...draws, [open.key]: strokes.slice(0, -1) }); return; }
    const prev = history[history.length - 1];
    if (prev) { save({ ...saved, [open.key]: prev }); setHistory(h => h.slice(0, -1)); }
  }
  function startOver() {
    if (!open) return;
    setFills([]); saveDraws({ ...draws, [open.key]: [] }); setNotice('A fresh page!');
  }
  function done() { playSound('yay'); setOpen(null); }

  if (!open) {
    const pages = PAGES.filter(p => p.group === group);
    const columns = width >= 900 ? 4 : width >= 560 ? 3 : 2;
    const tile = Math.floor(Math.min(220, (Math.min(width, 900) - 48 - (columns - 1) * 12) / columns));
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>🖍️ Pick a picture to colour!</Text>
        <Text style={styles.subtitle}>Tap a picture, then fill it in with colours or draw with the pencil ✏️</Text>
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
            <Pressable key={page.key} onPress={() => { setOpen(page); setHistory([]); setNotice(null); setMode('fill'); }} accessibilityRole="button" accessibilityLabel={`Colour ${page.name}`}
              style={({ pressed }) => [styles.pageTile, { width: tile }, pressed && styles.pressed]}>
              <View style={styles.pageArt}><Picture page={page} fills={saved[page.key] ?? []} strokes={draws[page.key]} size={tile - 24} /></View>
              <Text style={styles.pageName} numberOfLines={1}>{page.emoji} {page.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // Coloring a picture: big canvas on the left, colours + pencil down the right.
  // The canvas flexes to fill the row, so it can never grow wider than the card
  // (no spilling past the edge, whatever the screen). Its real pixel size is
  // measured from the laid-out box so taps map to the right spot, and a vertical
  // cap keeps the tools and the Done button in view without scrolling.
  const railW = width >= 560 ? 184 : width >= 400 ? 128 : 96;
  const swatch = width >= 560 ? 48 : 40;
  const maxCanvas = Math.max(200, Math.min(760, height - 210));
  // On a roomy screen the tools (Undo / Start over / Surprise / Done) tuck into
  // the right rail under the colours, so everything little hands need is on the
  // right and the canvas stays big. On small or short screens they stay along
  // the bottom, where a slim rail has no room for them.
  const toolsInRail = width >= 480 && height >= 560;
  canvasSize.current = canvas;
  const toolButtons = (
    <>
      <Tool icon="↩️" label="Undo" off={mode === 'draw' ? !strokes.length : !history.length} onPress={undo} style={toolsInRail ? styles.railToolBtn : undefined} />
      <Tool icon="🧽" label="Start over" onPress={startOver} style={toolsInRail ? styles.railToolBtn : undefined} />
      <Tool icon="✨" label="Surprise me!" danger onPress={surprise} style={toolsInRail ? styles.railToolBtn : undefined} />
      <Tool icon="✓" label="Done" done onPress={done} style={toolsInRail ? styles.railToolBtn : undefined} />
    </>
  );
  return (
    <View style={styles.panel}>
      <View style={styles.topRow}>
        <Pressable onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Back to the coloring book" style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
          <Text style={styles.toolIcon}>📚</Text><Text style={styles.toolText}>Book</Text>
        </Pressable>
        <Text style={styles.pageTitle} numberOfLines={1}>{open.emoji} {open.name}</Text>
      </View>

      <View style={[styles.studio, toolsInRail && { alignItems: 'center' }]}>
        <View style={[styles.canvasFrame, { flexGrow: 1, flexShrink: 1, flexBasis: 0, maxWidth: maxCanvas }]}>
          <View
            style={{ width: '100%', aspectRatio: 1, overflow: 'hidden' }}
            accessibilityLabel={`Colouring ${open.name}`}
            testID="coloring-canvas"
            onLayout={e => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && Math.abs(w - canvas) > 1) setCanvas(w); }}
            onStartShouldSetResponder={() => mode === 'draw'}
            onMoveShouldSetResponder={() => mode === 'draw'}
            onResponderGrant={beginStroke}
            onResponderMove={moveStroke}
            onResponderRelease={() => lock(false)}
            onResponderTerminate={() => lock(false)}
            onResponderTerminationRequest={() => false}
          >
            <Picture page={open} fills={fills} strokes={strokes} size={canvas} fill onPart={mode === 'fill' ? colour : undefined} />
            <Animated.Text pointerEvents="none" style={[styles.sparkle, { opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }] }]}>✨</Animated.Text>
          </View>
        </View>

        {/* The right rail: pencil / bucket, then every colour — always on screen. */}
        <View style={[styles.rail, { width: railW }]}>
          <View style={styles.modeRow}>
            <Tool icon="🪣" label="Fill" on={mode === 'fill'} onPress={() => setMode('fill')} style={styles.modeBtn} />
            <Tool icon="✏️" label="Draw" on={mode === 'draw'} onPress={() => setMode('draw')} style={styles.modeBtn} />
          </View>
          <View style={styles.palette} accessibilityRole="radiogroup">
            {CRAYONS.map((c, i) => (
              <Pressable key={c.name} onPress={() => pickCrayon(i)} accessibilityRole="radio" accessibilityLabel={`Crayon ${c.name}`} accessibilityState={{ checked: i === crayon }}
                style={[styles.crayon, { width: swatch, height: swatch, borderRadius: swatch / 2, backgroundColor: c.hex }, c.hex === '#FFFFFF' && styles.crayonWhite, i === crayon && styles.crayonOn]}>
                {i === crayon ? <Text style={[styles.crayonTick, c.hex === '#FFFFFF' || c.hex === '#FFD54A' ? { color: '#3F3550' } : null]}>✓</Text> : null}
              </Pressable>
            ))}
            {/* The rainbow picker: tap to mix any colour from a grid of shades. */}
            <Pressable key="more" onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel="More colours"
              style={[styles.crayon, { width: swatch, height: swatch, borderRadius: swatch / 2, backgroundColor: custom ?? '#FFFFFF' }, !custom && styles.crayonWhite, crayon === CRAYONS.length && styles.crayonOn]}>
              {custom
                ? (crayon === CRAYONS.length ? <Text style={styles.crayonTick}>✓</Text> : null)
                : <Text style={{ fontSize: swatch * 0.52 }}>🌈</Text>}
            </Pressable>
          </View>
          {toolsInRail ? <View style={styles.railTools}>{toolButtons}</View> : null}
        </View>
      </View>

      {!toolsInRail ? <View style={styles.tools}>{toolButtons}</View> : null}
      <Text style={styles.notice} accessibilityLiveRegion="polite">{notice ?? (mode === 'draw' ? 'Scribble on the picture with your pencil! ✏️' : 'Pick a colour, then tap a part to fill it. 🪣')}</Text>

      {pickerOpen ? (
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close colour picker" onPress={() => setPickerOpen(false)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>🌈 Pick any colour</Text>
            <View style={styles.pickerGrid}>
              {PICKER_COLORS.map((hex, i) => (
                <Pressable key={i} onPress={() => choosePicked(hex)} accessibilityRole="button" accessibilityLabel={`Colour ${hex}`}
                  style={({ pressed }) => [styles.pickerSwatch, { backgroundColor: hex }, hex.toLowerCase() === '#ffffff' && styles.crayonWhite, pressed && styles.pressed]} />
              ))}
            </View>
            <Tool icon="✓" label="Close" done onPress={() => setPickerOpen(false)} style={styles.pickerClose} />
          </View>
        </View>
      ) : null}
    </View>
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
  topRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { flex: 1, minWidth: 120, fontSize: 22, fontWeight: '900', color: '#53347E', textAlign: 'center' },
  studio: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 12, alignSelf: 'stretch' },
  rail: { alignItems: 'center', gap: 10 },
  railTools: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  railToolBtn: { alignSelf: 'stretch', width: '100%' },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  modeBtn: { minWidth: 54 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  canvasFrame: { padding: 0, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 3, borderBottomWidth: 7, borderColor: '#D9CCFA', overflow: 'hidden' },
  sparkle: { position: 'absolute', fontSize: 120, alignSelf: 'center', top: '30%' },
  crayon: { borderWidth: 3, borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  crayonWhite: { borderColor: '#D9CCFA' },
  crayonOn: { borderColor: '#3F3550', borderWidth: 4, transform: [{ scale: 1.12 }] },
  crayonTick: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  tool: { minWidth: 72, minHeight: 60, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#D9CCFA' },
  toolOn: { backgroundColor: '#7650C7', borderColor: '#54369A' },
  toolMagic: { backgroundColor: '#E5533D', borderColor: '#B23A27' },
  toolDone: { backgroundColor: '#2F9A5B', borderColor: '#1F7042' },
  toolOff: { opacity: 0.45 },
  toolIcon: { fontSize: 24 },
  toolText: { fontSize: 13, fontWeight: '900', color: '#53347E' },
  backBtn: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#D9CCFA' },
  notice: { fontSize: 16, fontWeight: '800', color: '#5A4B66', textAlign: 'center' },
  pressed: { transform: [{ scale: 0.95 }] },
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,30,60,0.35)', borderRadius: 28, padding: 16 },
  pickerCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 3, borderBottomWidth: 7, borderColor: '#D9CCFA', padding: 16, gap: 12, alignItems: 'center' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#53347E' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pickerSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)' },
  pickerClose: { minWidth: 120 },
});

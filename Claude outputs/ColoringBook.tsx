import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Path, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSound, useSoundEffects } from '../games/sounds';
import { speak, stopSpeaking } from '../speech';
import { CRAYONS, GROUPS, PAGES, type ColoringPage, type GroupKey } from './coloringPages';
import { drawingTouchStyle, useNative, useScrollLock, useUsableHeight } from './common';
import { useBackHandler } from '../backHandler';
import { GUTTER } from '../theme';

/**
 * The Coloring Book: pick a picture, then colour it in a studio laid out like a
 * real art table:
 *
 *   - the picture fills the middle of the screen;
 *   - a rail of tools sits down the right: brush, pencil, marker, paint bucket
 *     and eraser;
 *   - the colours are crayons that slide out from behind the rail when a mouse
 *     moves over it (or a finger taps a tool), and tuck away again when the
 *     mouse leaves or a colour is picked, so the picture stays big;
 *   - ✕, undo, start over and surprise sit along the top, ✓ Done beside them.
 *
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
/** Widest the studio grows (ArtMusic uses the same while a picture is open). */
export const STUDIO_MAX = 1180;

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

/** A round button for the top bar (✕, undo, start over, surprise, done). */
function RoundTool({ icon, label, onPress, off, tone = 'plain', size }: { icon: string; label: string; onPress: () => void; off?: boolean; tone?: 'plain' | 'close' | 'magic' | 'done'; size: number }) {
  const colours = { plain: ['#D9CCFA', '#B9A3EC'], close: ['#C04BD8', '#8E2CA6'], magic: ['#FFC83D', '#D29A0E'], done: ['#43B36B', '#2B8049'] }[tone];
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off }} hitSlop={4}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: colours[0], borderBottomColor: colours[1] }, off && styles.off, pressed && styles.pressed]}>
      <Text style={[styles.roundIcon, { fontSize: size * 0.44 }, tone === 'plain' && { color: '#5D439B' }]}>{icon}</Text>
    </Pressable>
  );
}

/** One crayon in the drawer: a coloured tip on a lavender barrel, like a real paint tube. */
function Crayon({ name, hex, width: length, height, chosen, rainbow, vertical, onPress }: { name: string; hex: string; width: number; height: number; chosen: boolean; rainbow?: boolean; vertical?: boolean; onPress: () => void }) {
  // Drawn lying down (tip on the left). Standing up (tip on top) it is the same drawing turned a quarter.
  const width = length - (chosen ? 0 : 14);
  const tipW = height * 1.25;
  const light = hex.toUpperCase() === '#FFFFFF' || hex.toUpperCase() === '#FFD54A';
  return (
    <Pressable onPress={onPress} accessibilityRole={rainbow ? 'button' : 'radio'} accessibilityLabel={rainbow ? 'More colours' : `Crayon ${name}`}
      accessibilityState={rainbow ? undefined : { checked: chosen }}
      aria-checked={rainbow ? undefined : chosen}
      style={({ pressed }) => [vertical ? { width: height, height: length, paddingTop: chosen ? 0 : 14 } : { width: length, height, paddingLeft: chosen ? 0 : 14 }, pressed && styles.pressed]}>
      <Svg width={vertical ? height : width} height={vertical ? width : height} viewBox={vertical ? `0 0 ${height} ${width}` : `0 0 ${width} ${height}`}>
        <G transform={vertical ? `translate(${height},0) rotate(90)` : undefined}>
        {/* barrel */}
        <Rect x={tipW * 0.7} y={height * 0.18} width={width - tipW * 0.7 + 16} height={height * 0.64} rx={height * 0.14} fill="#E9E3F3" stroke="#3F3550" strokeWidth={chosen ? 3.5 : 2.5} />
        <Rect x={tipW * 0.7 + 14} y={height * 0.24} width={Math.max(0, width - tipW * 0.7 - 14)} height={height * 0.12} rx={4} fill="#FFFFFF" opacity={0.8} />
        <Rect x={tipW * 0.92} y={height * 0.18} width={6} height={height * 0.64} fill="#CFC5E2" stroke="#3F3550" strokeWidth={2} />
        {/* tip */}
        {rainbow ? (
          <>
            <Circle cx={tipW * 0.5} cy={height / 2} r={height * 0.4} fill="#FFFFFF" stroke="#3F3550" strokeWidth={chosen ? 3.5 : 2.5} />
            <SvgText x={tipW * 0.5} y={height / 2 + height * 0.15} fontSize={height * 0.42} textAnchor="middle">🌈</SvgText>
          </>
        ) : (
          <Path d={`M ${tipW * 0.85} ${height * 0.12} C ${tipW * 0.3} ${height * 0.02}, ${tipW * 0.02} ${height * 0.3}, ${tipW * 0.1} ${height * 0.55} C ${tipW * 0.18} ${height * 0.86}, ${tipW * 0.55} ${height * 0.96}, ${tipW * 0.85} ${height * 0.88} Z`}
            fill={hex} stroke="#3F3550" strokeWidth={chosen ? 3.5 : 2.5} strokeLinejoin="round" />
        )}
        {!rainbow ? <Path d={`M ${tipW * 0.3} ${height * 0.3} Q ${tipW * 0.4} ${height * 0.2} ${tipW * 0.55} ${height * 0.22}`} stroke={light ? '#FFFFFF' : 'rgba(255,255,255,0.65)'} strokeWidth={height * 0.07} strokeLinecap="round" fill="none" /> : null}
        </G>
      </Svg>
    </Pressable>
  );
}

export default function ColoringBook({ childId, onStudio }: { childId: string; /** A picture opened or closed, so the page around can give the studio the whole screen. */ onStudio?: (open: boolean) => void }) {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();
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
  const [canvas, setCanvas] = useState(300);
  const sparkle = useRef(new Animated.Value(0)).current;
  // The colour in hand: a preset crayon, or the picked custom colour (index === CRAYONS.length).
  const activeHex = crayon === CRAYONS.length ? (custom ?? CRAYONS[0]!.hex) : CRAYONS[crayon]!.hex;
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; lock(false); stopSpeaking(); }; }, [lock]);

  // ── The crayon drawer: slides out on hover (mouse) or a tap on a tool (touch).
  const [drawer, setDrawer] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false); // mounted while open or sliding away
  const slide = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef(false); // a mouse is over the rail: keep the drawer open until it leaves
  const crayonList = useRef<ScrollView>(null);
  const listY = useRef(0);
  useEffect(() => {
    if (drawer) setDrawerShown(true);
    Animated.timing(slide, { toValue: drawer ? 1 : 0, duration: drawer ? 220 : 180, useNativeDriver: useNative }).start(({ finished }) => {
      if (finished && !drawer) setDrawerShown(false);
    });
  }, [drawer, slide]);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  const showDrawer = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setDrawer(true); };
  const hideDrawer = (after = 0) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { if (live.current) setDrawer(false); }, after);
  };

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
    setDrawer(false);
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
    // Tools that use a colour bring the crayons out; the eraser doesn't need them.
    if (key === 'eraser') setDrawer(false); else showDrawer();
  }
  function pickCrayon(i: number) {
    setCrayon(i); playSound('pop');
    if (tool === 'eraser') setTool('fill');
    stopSpeaking(); void speak(CRAYONS[i]!.name, { allowDeviceFallback: true });
    // With a finger, tuck the crayons away so the picture is clear again; with a
    // mouse they stay until the pointer leaves.
    if (!hovering.current) hideDrawer(350);
  }
  // The rainbow picker: tapping a shade makes it the colour in hand.
  function choosePicked(hex: string) { setCustom(hex); setCrayon(CRAYONS.length); setPickerOpen(false); playSound('pop'); if (tool === 'eraser') setTool('fill'); }
  const scrollCrayons = (by: number) => crayonList.current?.scrollTo({ y: Math.max(0, listY.current + by), animated: true }); // the upright drawer (portrait) scrolls by swiping

  // Drawing and erasing: drags on the picture.
  const canvasSize = useRef(canvas);
  const at = (e: GestureResponderEvent): [number, number] => [
    Math.max(0, Math.min(100, (e.nativeEvent.locationX / canvasSize.current) * 100)),
    Math.max(0, Math.min(100, (e.nativeEvent.locationY / canvasSize.current) * 100)),
  ];
  const erased = useRef(false);
  const drawing = tool === 'brush' || tool === 'pencil' || tool === 'marker';
  const eraseAt = (p: [number, number], list: Stroke[]) => list.filter(s => !s.points.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) <= ERASE_RADIUS + (s.w ?? 3.6) / 2));
  function beginStroke(e: GestureResponderEvent) {
    if (!open) return;
    lock(true); setDrawer(false);
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
  function done() { playSound('yay'); setDrawer(false); setOpen(null); }

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
            <Pressable key={page.key} onPress={() => { setOpen(page); setHistory([]); setNotice(null); setTool('fill'); setDrawer(false); }} accessibilityRole="button" accessibilityLabel={`Colour ${page.name}`}
              style={({ pressed }) => [styles.pageTile, { width: tile }, pressed && styles.pressed]}>
              <View style={styles.pageArt}><Picture page={page} fills={saved[page.key] ?? []} strokes={draws[page.key]} size={tile - 24} /></View>
              <Text style={styles.pageName} numberOfLines={1}>{page.emoji} {page.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // ── The studio. Sizes come from the space the studio really has, so the
  // picture is as big as possible while the top bar and the tool rail stay on
  // screen without scrolling.
  const small = width < 480;
  // The space the studio has: the window inside the game page's side padding, up to
  // STUDIO_MAX (ArtMusic widens to that while a picture is open), less this panel's padding.
  const studioW = Math.min(width - GUTTER * 2, STUDIO_MAX) - 20;
  const topSize = small ? 42 : 52;
  // A phone held upright: the tools run along the bottom and the crayons slide up,
  // so the picture can use the full width. Otherwise the tools run down the right.
  const portrait = width < 600 && height > width * 1.25;
  const slots = TOOLS.length + 1; // five tools and the colour chip
  let railW: number, railH: number, canvasSide: number, toolSize: number, studioH: number, doneOnSide = false;
  if (portrait) {
    toolSize = Math.max(34, Math.min(58, Math.floor((studioW - 16) / slots) - 8));
    railH = toolSize + 16;
    railW = studioW;
    canvasSide = Math.floor(Math.max(180, Math.min(studioW, height - topSize - railH - 80)));
    studioH = canvasSide + 10 + railH;
  } else {
    railW = small ? 62 : width < 900 ? 84 : 104;
    doneOnSide = studioW - railW >= 620; // room for ✓ in its own column on the left, as on a tablet
    canvasSide = Math.floor(Math.max(180, Math.min(studioW - railW - (doneOnSide ? topSize + 34 : 0) - 20, height - topSize - 64, 820)));
    studioH = canvasSide;
    railH = studioH;
    // The tools share the rail's height, so they shrink on a short (sideways) screen.
    toolSize = Math.max(34, Math.min(railW - (small ? 12 : 18), Math.floor((studioH - 12) / slots) - 8));
  }
  const sideW = doneOnSide ? topSize + 24 : 0;
  const drawerW = portrait ? studioW : Math.min(small ? 200 : 260, Math.max(150, canvasSide * 0.6));
  const crayonH = small || portrait ? 44 : 54;
  const crayonLength = portrait ? Math.min(150, Math.max(110, canvasSide * 0.42)) : drawerW - 18;
  const drawerH = portrait ? crayonLength + 12 : studioH;
  canvasSize.current = canvas;
  const colourCount = CRAYONS.length + 1;
  const help = notice ?? null;

  return (
    <View testID="coloring-studio" style={[styles.panel, styles.studioPanel]}>
      {/* Top bar: ✕ back to the book; undo, start over and surprise in the middle; ✓ Done on the right when there's no side column. */}
      <View style={styles.topBar}>
        <RoundTool icon="✕" label="Back to the coloring book" tone="close" onPress={() => { setDrawer(false); setOpen(null); }} size={topSize} />
        <View style={styles.topMiddle}>
          <RoundTool icon="↶" label="Undo" off={!history.length} onPress={undo} size={topSize} />
          <RoundTool icon="🗑️" label="Start over" off={!fills.length && !strokes.length} onPress={startOver} size={topSize} />
          <RoundTool icon="✨" label="Surprise me!" tone="magic" onPress={surprise} size={topSize} />
        </View>
        {doneOnSide ? <View style={{ width: topSize }} /> : <RoundTool icon="✓" label="Done" tone="done" onPress={done} size={topSize} />}
      </View>

      <View style={[styles.studio, portrait && styles.studioColumn, { height: studioH }]}>
        {doneOnSide ? (
          <View style={[styles.side, { width: sideW }]}>
            <RoundTool icon="✓" label="Done" tone="done" onPress={done} size={topSize + 16} />
          </View>
        ) : null}

        <View style={[styles.canvasFrame, { width: canvasSide, height: canvasSide }]}>
          <View
            style={[{ width: '100%', height: '100%', overflow: 'hidden' }, drawingTouchStyle]}
            accessibilityLabel={`Colouring ${open.name}`}
            testID="coloring-canvas"
            onLayout={e => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && Math.abs(w - canvas) > 1) setCanvas(w); }}
            onStartShouldSetResponder={() => drawing}
            onMoveShouldSetResponder={() => drawing || tool === 'eraser'}
            onResponderGrant={beginStroke}
            onResponderMove={moveStroke}
            onResponderRelease={() => lock(false)}
            onResponderTerminate={() => lock(false)}
            onResponderTerminationRequest={() => false}
          >
            <Picture page={open} fills={fills} strokes={strokes} size={canvas} fill onPart={tool === 'fill' || tool === 'eraser' ? tapPart : undefined} />
            <Animated.Text pointerEvents="none" style={[styles.sparkle, { opacity: sparkle.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.6] }) }] }]}>✨</Animated.Text>
            {help ? <View pointerEvents="none" style={styles.toast}><Text style={styles.toastText} accessibilityLiveRegion="polite">{help}</Text></View> : null}
          </View>
        </View>

        {/* The tool rail, and the crayon drawer that slides out from behind it.
            A mouse over either keeps the crayons out; leaving tucks them away. */}
        <View
          onPointerEnter={e => { if (e.nativeEvent.pointerType !== 'mouse') return; hovering.current = true; showDrawer(); }}
          onPointerLeave={e => { if (e.nativeEvent.pointerType !== 'mouse') return; hovering.current = false; hideDrawer(300); }}
          style={[styles.railArea, { width: railW, height: railH }]}
        >
          {drawerShown ? (
            <Animated.View
              testID="crayon-drawer"
              pointerEvents={drawer ? 'auto' : 'none'}
              style={[portrait ? styles.drawerUp : styles.drawer, portrait ? { width: drawerW, bottom: railH - 6, height: drawerH } : { width: drawerW, right: railW - 6, height: drawerH }, {
                opacity: slide,
                transform: portrait
                  ? [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [drawerH * 0.7, 0] }) }]
                  : [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [drawerW * 0.7, 0] }) }],
              }]}
            >
              {portrait ? null : <Pressable onPress={() => scrollCrayons(-crayonH * 3)} accessibilityRole="button" accessibilityLabel="More crayons above" style={styles.drawerArrow}><Text style={styles.drawerArrowText}>▲</Text></Pressable>}
              <ScrollView ref={crayonList} horizontal={portrait} style={{ flex: 1 }} contentContainerStyle={portrait ? styles.crayonsRow : styles.crayons} accessibilityRole="radiogroup"
                showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
                onScroll={e => { listY.current = portrait ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y; }} scrollEventThrottle={32}>
                {CRAYONS.map((c, i) => (
                  <Crayon key={c.name} name={c.name} hex={c.hex} width={crayonLength} height={crayonH} vertical={portrait} chosen={i === crayon} onPress={() => pickCrayon(i)} />
                ))}
                <Crayon name="more" hex={custom ?? '#FFFFFF'} rainbow width={crayonLength} height={crayonH} vertical={portrait} chosen={crayon === CRAYONS.length}
                  onPress={() => { setPickerOpen(true); setDrawer(false); }} />
              </ScrollView>
              {portrait ? null : <Pressable onPress={() => scrollCrayons(crayonH * 3)} accessibilityRole="button" accessibilityLabel="More crayons below" style={styles.drawerArrow}><Text style={styles.drawerArrowText}>▼</Text></Pressable>}
            </Animated.View>
          ) : null}

          <View style={[styles.rail, portrait && styles.railRow, { width: railW, height: railH }]}>
            {TOOLS.map(t => {
              const on = t.key === tool;
              return (
                <Pressable key={t.key} onPress={() => chooseTool(t.key)} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.railTool, { width: toolSize, height: toolSize, borderRadius: toolSize * 0.28 }, on && styles.railToolOn, pressed && styles.pressed]}>
                  <Text style={{ fontSize: toolSize * 0.5 }}>{t.icon}</Text>
                  {on && t.key !== 'eraser' ? <View style={[styles.inHand, { backgroundColor: activeHex }, activeHex.toUpperCase() === '#FFFFFF' && styles.inHandWhite]} /> : null}
                </Pressable>
              );
            })}
            {/* Shows the colour in hand; a tap brings the crayons out (handy without a mouse). */}
            <Pressable onPress={() => (drawer && !hovering.current ? setDrawer(false) : showDrawer())} accessibilityRole="button" accessibilityLabel={drawer ? 'Hide the crayons' : 'Choose a colour'}
              accessibilityHint={`${colourCount} colours`}
              style={({ pressed }) => [styles.colourChip, { width: toolSize * 0.72, height: toolSize * 0.72, borderRadius: toolSize * 0.36, backgroundColor: activeHex }, activeHex.toUpperCase() === '#FFFFFF' && styles.inHandWhite, pressed && styles.pressed]}>
              <Text style={styles.colourChipText}>{portrait ? (drawer ? '⌄' : '⌃') : drawer ? '›' : '‹'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {pickerOpen ? (
        <View style={styles.pickerOverlay}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close colour picker" onPress={() => setPickerOpen(false)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>🌈 Pick any colour</Text>
            <View style={styles.pickerGrid}>
              {PICKER_COLORS.map((hex, i) => (
                <Pressable key={i} onPress={() => choosePicked(hex)} accessibilityRole="button" accessibilityLabel={`Colour ${hex}`}
                  style={({ pressed }) => [styles.pickerSwatch, { backgroundColor: hex }, hex.toLowerCase() === '#ffffff' && styles.inHandWhite, pressed && styles.pressed]} />
              ))}
            </View>
            <Pressable onPress={() => setPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [styles.pickerClose, pressed && styles.pressed]}>
              <Text style={styles.pickerCloseText}>✓ Close</Text>
            </Pressable>
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
  studioPanel: { alignSelf: 'stretch', backgroundColor: '#DCD3F7', padding: 10, gap: 10 },
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

  topBar: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topMiddle: { flexDirection: 'row', gap: 10 },
  round: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5 },
  roundIcon: { color: '#FFFFFF', fontWeight: '900' },
  off: { opacity: 0.4 },

  studio: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  studioColumn: { flexDirection: 'column', justifyContent: 'flex-start' },
  side: { alignItems: 'center', justifyContent: 'center' },
  canvasFrame: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#3F3550', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  sparkle: { position: 'absolute', fontSize: 120, alignSelf: 'center', top: '30%' },
  toast: { position: 'absolute', left: 10, right: 10, bottom: 10, alignItems: 'center' },
  toastText: { fontSize: 16, fontWeight: '900', color: '#3F3550', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden' },

  railArea: { position: 'relative', zIndex: 5, ...(Platform.OS === 'web' ? { cursor: 'default' } as object : null) },
  railRow: { flexDirection: 'row', paddingVertical: 0, paddingHorizontal: 6 },
  rail: { alignItems: 'center', justifyContent: 'space-evenly', backgroundColor: '#F7F4FF', borderRadius: 22, paddingVertical: 6, zIndex: 2 },
  railTool: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6DEFB', borderWidth: 3, borderColor: 'transparent', borderBottomColor: '#C9BCEF', borderBottomWidth: 5 },
  railToolOn: { backgroundColor: '#FFFFFF', borderColor: '#E0434F', borderBottomColor: '#E0434F' },
  inHand: { position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: '#FFFFFF' },
  inHandWhite: { borderColor: '#B9A3EC' },
  colourChip: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#3F3550', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  colourChipText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 2 },

  drawer: { position: 'absolute', top: 0, zIndex: 1, overflow: 'hidden', backgroundColor: 'rgba(247,244,255,0.97)', borderTopLeftRadius: 22, borderBottomLeftRadius: 22, borderWidth: 2, borderRightWidth: 0, borderColor: '#FFFFFF', paddingLeft: 6, paddingVertical: 4, shadowColor: '#3F3550', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: -3, height: 3 }, elevation: 6 },
  drawerArrow: { alignSelf: 'center', width: 64, height: 26, borderRadius: 10, backgroundColor: '#E6DEFB', alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  drawerArrowText: { fontSize: 15, color: '#8E78D6', fontWeight: '900' },
  crayons: { gap: 4, paddingVertical: 4 },
  crayonsRow: { gap: 6, paddingHorizontal: 6, alignItems: 'flex-end' },
  drawerUp: { position: 'absolute', left: 0, zIndex: 1, overflow: 'hidden', backgroundColor: 'rgba(247,244,255,0.97)', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 2, borderBottomWidth: 0, borderColor: '#FFFFFF', paddingTop: 6, shadowColor: '#3F3550', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: -3 }, elevation: 6 },

  pressed: { transform: [{ scale: 0.95 }] },
  pickerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,30,60,0.35)', borderRadius: 28, padding: 16, zIndex: 20 },
  pickerCard: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 3, borderBottomWidth: 7, borderColor: '#D9CCFA', padding: 16, gap: 12, alignItems: 'center' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#53347E' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pickerSwatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'rgba(0,0,0,0.12)' },
  pickerClose: { minWidth: 120, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#2F9A5B', borderBottomWidth: 5, borderBottomColor: '#1F7042' },
  pickerCloseText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
});

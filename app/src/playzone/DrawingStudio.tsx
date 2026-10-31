import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useNative, useUsableHeight } from './common';
import { GUTTER } from '../theme';

/**
 * The one layout every drawing and colouring activity uses, so they all feel
 * the same and the picture gets as much of the screen as possible:
 *
 *   top bar     ✕ back · the actions kids use all the time (undo, start over,
 *               surprise, save…) · ✓ done
 *   middle      the picture, as big as the screen allows
 *   tool rail   brush, pencil, bucket, eraser… down the right (along the
 *               bottom on an upright phone), with a round chip showing the
 *               colour in hand
 *   crayons     hidden until needed: they slide out from behind the rail when
 *               a mouse moves over it, or when a finger taps a tool or the
 *               colour chip, and tuck away again when the mouse leaves or a
 *               colour is picked
 *
 * The activity supplies the picture (renderCanvas), its tools, colours and
 * actions; this file owns sizes, the drawer and the hover/tap behaviour.
 */
export type StudioTool = { key: string; icon: string; label: string; /** Picking this tool brings the crayons out. */ usesColour?: boolean };
export type StudioColour = { key: string; hex: string; /** Read by screen readers (and tests), e.g. "Crayon red" or "5 Blue". */ label: string; /** Printed on the crayon: a number or word for paint-by-number / word. */ tag?: string; role?: 'radio' | 'button' };
export type StudioAction = { key: string; icon: string; label: string; onPress: () => void; disabled?: boolean; tone?: 'plain' | 'magic' };

/** Widest a studio grows (ArtMusic lets the page widen to this while one is open). */
export const STUDIO_MAX = 1180;

const TONES = { plain: ['#D9CCFA', '#B9A3EC'], close: ['#C04BD8', '#8E2CA6'], magic: ['#FFC83D', '#D29A0E'], done: ['#43B36B', '#2B8049'] } as const;

function RoundTool({ icon, label, onPress, off, tone = 'plain', size }: { icon: string; label: string; onPress: () => void; off?: boolean; tone?: keyof typeof TONES; size: number }) {
  const [face, lip] = TONES[tone];
  return (
    <Pressable onPress={onPress} disabled={off} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!off }} hitSlop={4}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: face, borderBottomColor: lip }, off && styles.off, pressed && styles.pressed]}>
      <Text style={[styles.roundIcon, { fontSize: size * 0.44 }, tone === 'plain' && { color: '#5D439B' }]}>{icon}</Text>
    </Pressable>
  );
}

/** One crayon: a coloured tip on a lavender barrel. Lying down (tip left) or standing up (tip on top). */
function Crayon({ colour, length, thick, chosen, rainbow, vertical, onPress }: { colour: StudioColour; length: number; thick: number; chosen: boolean; rainbow?: boolean; vertical?: boolean; onPress: () => void }) {
  const width = length - (chosen ? 0 : 14);
  const tipW = thick * 1.25;
  const h = thick;
  const light = ['#FFFFFF', '#FFD54A', '#F8D75B'].includes(colour.hex.toUpperCase());
  return (
    <Pressable onPress={onPress} accessibilityRole={colour.role ?? 'radio'} accessibilityLabel={colour.label}
      accessibilityState={colour.role === 'button' ? undefined : { checked: chosen }} aria-checked={colour.role === 'button' ? undefined : chosen}
      style={({ pressed }) => [vertical ? { width: h, height: length, paddingTop: chosen ? 0 : 14 } : { width: length, height: h, paddingLeft: chosen ? 0 : 14 }, pressed && styles.pressed]}>
      <Svg width={vertical ? h : width} height={vertical ? width : h} viewBox={vertical ? `0 0 ${h} ${width}` : `0 0 ${width} ${h}`}>
        <G transform={vertical ? `translate(${h},0) rotate(90)` : undefined}>
          <Rect x={tipW * 0.7} y={h * 0.18} width={width - tipW * 0.7 + 16} height={h * 0.64} rx={h * 0.14} fill="#E9E3F3" stroke="#3F3550" strokeWidth={chosen ? 3.5 : 2.5} />
          <Rect x={tipW * 0.7 + 14} y={h * 0.24} width={Math.max(0, width - tipW * 0.7 - 14)} height={h * 0.12} rx={4} fill="#FFFFFF" opacity={0.8} />
          <Rect x={tipW * 0.92} y={h * 0.18} width={6} height={h * 0.64} fill="#CFC5E2" stroke="#3F3550" strokeWidth={2} />
          {colour.tag ? <SvgText x={tipW * 0.92 + 14} y={h * 0.5 + h * 0.13} fontSize={h * 0.36} fontWeight="900" fill="#3F3550" fontFamily="Arial, Helvetica, sans-serif">{colour.tag}</SvgText> : null}
          {rainbow ? (
            <>
              <Circle cx={tipW * 0.5} cy={h / 2} r={h * 0.4} fill="#FFFFFF" stroke="#3F3550" strokeWidth={chosen ? 3.5 : 2.5} />
              <SvgText x={tipW * 0.5} y={h / 2 + h * 0.15} fontSize={h * 0.42} textAnchor="middle">🌈</SvgText>
            </>
          ) : (
            <Path d={`M ${tipW * 0.85} ${h * 0.12} C ${tipW * 0.3} ${h * 0.02}, ${tipW * 0.02} ${h * 0.3}, ${tipW * 0.1} ${h * 0.55} C ${tipW * 0.18} ${h * 0.86}, ${tipW * 0.55} ${h * 0.96}, ${tipW * 0.85} ${h * 0.88} Z`}
              fill={colour.hex} stroke="#3F3550" strokeWidth={chosen ? 3.5 : 2.5} strokeLinejoin="round" />
          )}
          {!rainbow ? <Path d={`M ${tipW * 0.3} ${h * 0.3} Q ${tipW * 0.4} ${h * 0.2} ${tipW * 0.55} ${h * 0.22}`} stroke={light ? '#FFFFFF' : 'rgba(255,255,255,0.65)'} strokeWidth={h * 0.07} strokeLinecap="round" fill="none" /> : null}
        </G>
      </Svg>
    </Pressable>
  );
}

export default function DrawingStudio({
  testID, closeLabel, onClose, actions, done, tools, tool, onTool, colours, colour, onColour, more,
  aspect = 1, renderCanvas, notice, overlay, reserve = 0,
}: {
  testID?: string;
  closeLabel: string;
  onClose: () => void;
  actions: StudioAction[];
  done?: { label: string; onPress: () => void };
  tools: StudioTool[];
  tool: string;
  onTool: (key: string) => void;
  colours: StudioColour[];
  /** Index of the colour in hand; colours.length means the rainbow ("more") colour. */
  colour: number;
  onColour: (index: number) => void;
  /** The 🌈 crayon at the end: opens a full colour picker. */
  more?: { hex: string | null; onPress: () => void };
  /** Width ÷ height of the picture. */
  aspect?: number;
  renderCanvas: (width: number, height: number) => React.ReactNode;
  /** A short message that floats over the bottom of the picture. */
  notice?: string | null;
  /** Pop-ups the activity owns (a picture chooser, a colour picker, "start over?"). */
  overlay?: React.ReactNode;
  /** Extra height to leave free below the studio (for activities with a status line). */
  reserve?: number;
}) {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();

  // ── Crayon drawer
  const [drawer, setDrawer] = useState(false);
  const [drawerShown, setDrawerShown] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovering = useRef(false);
  const live = useRef(true);
  const list = useRef<ScrollView>(null);
  const listAt = useRef(0);
  useEffect(() => { live.current = true; return () => { live.current = false; if (closeTimer.current) clearTimeout(closeTimer.current); }; }, []);
  useEffect(() => {
    if (drawer) setDrawerShown(true);
    Animated.timing(slide, { toValue: drawer ? 1 : 0, duration: drawer ? 220 : 180, useNativeDriver: useNative }).start(({ finished }) => {
      if (finished && !drawer && live.current) setDrawerShown(false);
    });
  }, [drawer, slide]);
  const showDrawer = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setDrawer(true); };
  const hideDrawer = (after = 0) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => { if (live.current) setDrawer(false); }, after);
  };
  const usesColour = tools.length === 0 || !!tools.find(t => t.key === tool)?.usesColour;
  const chooseTool = (t: StudioTool) => { onTool(t.key); if (t.usesColour) showDrawer(); else setDrawer(false); };
  const chooseColour = (i: number) => {
    onColour(i);
    // A finger: tuck the crayons away so the picture is clear. A mouse: they stay until it leaves.
    if (!hovering.current) hideDrawer(350);
  };

  // ── Sizes
  const small = width < 480;
  // A phone keeps only a thin frame round the studio, so the picture gets every pixel it can.
  const pad = small ? 6 : 10;
  const studioW = Math.min(width - GUTTER * 2 + (small ? GUTTER - 6 : 0) * 2, STUDIO_MAX) - pad * 2;
  const n = actions.length + 2;
  const topSize = Math.max(36, Math.min(small ? 46 : 54, Math.floor((studioW - (n - 1) * 8) / n)));
  const portrait = width < 600 && height > width * 1.25;
  const slots = tools.length + 1;
  const free = height - topSize - pad * 2 - 24 - reserve;
  let railW: number, railH: number, toolSize: number, boxW: number, boxH: number, doneOnSide = false;
  if (portrait) {
    toolSize = Math.max(34, Math.min(58, Math.floor((studioW - 16) / slots) - 8));
    railH = toolSize + 16;
    railW = studioW;
    boxW = studioW;
    boxH = Math.max(160, free - railH - 10);
  } else {
    railW = small ? 62 : width < 900 ? 84 : 104;
    doneOnSide = !!done && studioW - railW >= 620;
    boxW = studioW - railW - (doneOnSide ? topSize + 34 : 0) - 10;
    boxH = Math.max(160, Math.min(free, 820));
    railH = 0; toolSize = 0; // set below from the picture's height
  }
  let canvasW = Math.floor(Math.min(boxW, boxH * aspect));
  let canvasH = Math.floor(canvasW / aspect);
  if (!portrait) {
    // The rail is as tall as the picture, but never so short that the tools get tiny.
    railH = Math.max(canvasH, slots * 46 + 12);
    toolSize = Math.max(34, Math.min(railW - (small ? 12 : 18), Math.floor((railH - 12) / slots) - 8));
  }
  const studioH = portrait ? canvasH + 10 + railH : Math.max(canvasH, railH);
  const drawerW = portrait ? studioW : Math.min(small ? 200 : 260, Math.max(150, canvasW * 0.6));
  const crayonH = small || portrait ? 44 : 54;
  const crayonLength = portrait ? Math.min(150, Math.max(110, canvasH * 0.42)) : drawerW - 18;
  const drawerH = portrait ? crayonLength + 12 : railH;
  const inHand = colour >= colours.length ? (more?.hex ?? '#FFFFFF') : colours[colour]?.hex ?? '#FFFFFF';
  const whiteish = inHand.toUpperCase() === '#FFFFFF';
  const scroll = (by: number) => list.current?.scrollTo({ y: Math.max(0, listAt.current + by), animated: true });

  return (
    <View testID={testID} style={[styles.panel, { padding: pad }, small && { marginHorizontal: -(GUTTER - 6) }]}>
      <View style={styles.topBar}>
        <RoundTool icon="✕" label={closeLabel} tone="close" onPress={() => { setDrawer(false); onClose(); }} size={topSize} />
        <View style={styles.topMiddle}>
          {actions.map(a => <RoundTool key={a.key} icon={a.icon} label={a.label} off={a.disabled} tone={a.tone ?? 'plain'} onPress={a.onPress} size={topSize} />)}
        </View>
        {done && !doneOnSide ? <RoundTool icon="✓" label={done.label} tone="done" onPress={() => { setDrawer(false); done.onPress(); }} size={topSize} /> : <View style={{ width: topSize }} />}
      </View>

      <View style={[styles.studio, portrait && styles.studioColumn, { height: studioH }]}>
        {doneOnSide && done ? (
          <View style={[styles.side, { width: topSize + 24 }]}>
            <RoundTool icon="✓" label={done.label} tone="done" onPress={() => { setDrawer(false); done.onPress(); }} size={topSize + 16} />
          </View>
        ) : null}

        {/* Touching the picture puts the crayons away (without stealing the touch). */}
        <View style={[styles.canvasFrame, { width: canvasW, height: canvasH }]} onStartShouldSetResponderCapture={() => { if (drawer && !hovering.current) setDrawer(false); return false; }}>
          {renderCanvas(canvasW, canvasH)}
          {notice ? <View pointerEvents="none" style={styles.toast}><Text style={styles.toastText} accessibilityLiveRegion="polite">{notice}</Text></View> : null}
        </View>

        <View
          onPointerEnter={e => { if (e.nativeEvent.pointerType !== 'mouse') return; hovering.current = true; if (usesColour) showDrawer(); }}
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
              {portrait ? null : <Pressable onPress={() => scroll(-crayonH * 3)} accessibilityRole="button" accessibilityLabel="More crayons above" style={styles.drawerArrow}><Text style={styles.drawerArrowText}>▲</Text></Pressable>}
              <ScrollView ref={list} horizontal={portrait} style={{ flex: 1 }} contentContainerStyle={portrait ? styles.crayonsRow : styles.crayons} accessibilityRole="radiogroup"
                showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
                onScroll={e => { listAt.current = portrait ? e.nativeEvent.contentOffset.x : e.nativeEvent.contentOffset.y; }}>
                {colours.map((c, i) => <Crayon key={c.key} colour={c} length={crayonLength} thick={crayonH} vertical={portrait} chosen={i === colour} onPress={() => chooseColour(i)} />)}
                {more ? <Crayon colour={{ key: 'more', hex: more.hex ?? '#FFFFFF', label: 'More colours', role: 'button' }} rainbow length={crayonLength} thick={crayonH} vertical={portrait}
                  chosen={colour >= colours.length} onPress={() => { setDrawer(false); more.onPress(); }} /> : null}
              </ScrollView>
              {portrait ? null : <Pressable onPress={() => scroll(crayonH * 3)} accessibilityRole="button" accessibilityLabel="More crayons below" style={styles.drawerArrow}><Text style={styles.drawerArrowText}>▼</Text></Pressable>}
            </Animated.View>
          ) : null}

          <View style={[styles.rail, portrait && styles.railRow, { width: railW, height: railH }]}>
            {tools.map(t => {
              const on = t.key === tool;
              return (
                <Pressable key={t.key} onPress={() => chooseTool(t)} accessibilityRole="button" accessibilityLabel={t.label} accessibilityState={{ selected: on }} aria-selected={on}
                  style={({ pressed }) => [styles.railTool, { width: toolSize, height: toolSize, borderRadius: toolSize * 0.28 }, on && styles.railToolOn, pressed && styles.pressed]}>
                  <Text style={{ fontSize: toolSize * 0.5 }}>{t.icon}</Text>
                  {on && t.usesColour ? <View style={[styles.inHand, { backgroundColor: inHand }, whiteish && styles.inHandWhite]} /> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => (drawer && !hovering.current ? setDrawer(false) : showDrawer())} accessibilityRole="button" accessibilityLabel={drawer ? 'Hide the crayons' : 'Choose a colour'}
              style={({ pressed }) => [styles.colourChip, { width: Math.max(34, toolSize * 0.72), height: Math.max(34, toolSize * 0.72), borderRadius: 99, backgroundColor: inHand }, whiteish && styles.inHandWhite, pressed && styles.pressed]}>
              <Text style={styles.colourChipText}>{portrait ? (drawer ? '⌄' : '⌃') : drawer ? '›' : '‹'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { alignSelf: 'stretch', alignItems: 'center', gap: 10, backgroundColor: '#DCD3F7', borderRadius: 28, padding: 10 },
  topBar: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  topMiddle: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  round: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5 },
  roundIcon: { color: '#FFFFFF', fontWeight: '900' },
  off: { opacity: 0.4 },
  studio: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  studioColumn: { flexDirection: 'column', justifyContent: 'flex-start' },
  side: { alignItems: 'center', justifyContent: 'center' },
  canvasFrame: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', shadowColor: '#3F3550', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  toast: { position: 'absolute', left: 10, right: 10, bottom: 10, alignItems: 'center' },
  toastText: { fontSize: 16, fontWeight: '900', color: '#3F3550', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, overflow: 'hidden', textAlign: 'center' },
  railArea: { position: 'relative', zIndex: 5, ...(Platform.OS === 'web' ? { cursor: 'default' } as object : null) },
  rail: { alignItems: 'center', justifyContent: 'space-evenly', backgroundColor: '#F7F4FF', borderRadius: 22, paddingVertical: 6, zIndex: 2 },
  railRow: { flexDirection: 'row', paddingVertical: 0, paddingHorizontal: 6 },
  railTool: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6DEFB', borderWidth: 3, borderColor: 'transparent', borderBottomColor: '#C9BCEF', borderBottomWidth: 5 },
  railToolOn: { backgroundColor: '#FFFFFF', borderColor: '#E0434F', borderBottomColor: '#E0434F' },
  inHand: { position: 'absolute', right: -4, bottom: -4, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: '#FFFFFF' },
  inHandWhite: { borderColor: '#B9A3EC' },
  colourChip: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#3F3550', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  colourChipText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 2 },
  drawer: { position: 'absolute', top: 0, zIndex: 1, overflow: 'hidden', backgroundColor: 'rgba(247,244,255,0.97)', borderTopLeftRadius: 22, borderBottomLeftRadius: 22, borderWidth: 2, borderRightWidth: 0, borderColor: '#FFFFFF', paddingLeft: 6, paddingVertical: 4, shadowColor: '#3F3550', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: -3, height: 3 }, elevation: 6 },
  drawerUp: { position: 'absolute', left: 0, zIndex: 1, overflow: 'hidden', backgroundColor: 'rgba(247,244,255,0.97)', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 2, borderBottomWidth: 0, borderColor: '#FFFFFF', paddingTop: 6, shadowColor: '#3F3550', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: -3 }, elevation: 6 },
  drawerArrow: { alignSelf: 'center', width: 64, height: 26, borderRadius: 10, backgroundColor: '#E6DEFB', alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  drawerArrowText: { fontSize: 15, color: '#8E78D6', fontWeight: '900' },
  crayons: { gap: 4, paddingVertical: 4 },
  crayonsRow: { gap: 6, paddingHorizontal: 6, alignItems: 'flex-end' },
  pressed: { transform: [{ scale: 0.95 }] },
});

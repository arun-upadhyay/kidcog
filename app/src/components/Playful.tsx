import React from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import Owl from './Owl';

/**
 * The bright, chunky pieces the front pages are built from: buttons with a
 * thick "lip" that squash when pressed, ribbon labels that sit on a card's
 * border, and the little stage Owl stands on. All drawn here (plain views and
 * SVG), no images, so they look the same on iPhone, Android and the web.
 */

export const PLAY = {
  coral: { face: '#E5533D', lip: '#B23A27', text: '#FFFFFF', soft: '#FFE7E1' },
  sky: { face: '#2F7BDB', lip: '#1D57A6', text: '#FFFFFF', soft: '#E3EFFD' },
  grass: { face: '#2F9A5B', lip: '#1F7042', text: '#FFFFFF', soft: '#E1F4E8' },
  sun: { face: '#FFC83D', lip: '#D29A0E', text: '#5A3A00', soft: '#FFF4D2' },
  grape: { face: '#7650C7', lip: '#54369A', text: '#FFFFFF', soft: '#EFE8FF' },
  white: { face: '#FFFFFF', lip: '#C9D8F2', text: '#1D57A6', soft: '#FFFFFF' },
} as const;
export type PlayColour = keyof typeof PLAY;

/** A big pill button with a darker lip underneath; it presses down when tapped. */
export function ChunkyButton({ title, label, onPress, colour = 'coral', size = 'lg', disabled, loading, style, testID }: {
  title: string;
  /** Spoken name, when it should differ from the words on the button. */
  label?: string;
  onPress: () => void;
  colour?: PlayColour;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = PLAY[colour];
  const off = disabled || loading;
  const lip = size === 'sm' ? 3 : 5;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' ? styles.sm : size === 'md' ? styles.md : styles.lg,
        { backgroundColor: c.face, borderColor: c.lip, borderBottomWidth: lip },
        colour === 'white' && styles.whiteEdge,
        pressed && !off && { borderBottomWidth: 1, marginTop: lip - 1 },
        off && styles.off,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? <ActivityIndicator color={c.text} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.text, size === 'sm' ? styles.textSm : size === 'md' ? styles.textMd : styles.textLg, { color: c.text }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

/** A pill label that sits across the top border of a card. */
export function Ribbon({ text, colour = 'grape' }: { text: string; colour?: PlayColour }) {
  const c = PLAY[colour];
  return (
    <View style={styles.ribbonRow} pointerEvents="none">
      <View style={[styles.ribbon, { backgroundColor: c.face, borderColor: c.lip }]}>
        <Text style={[styles.ribbonText, { color: c.text }]} numberOfLines={1}>{text}</Text>
      </View>
    </View>
  );
}

/** Four-pointed sparkle centred on (x, y). */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

/** A toy block with a letter or number on it. */
function Block({ x, y, size, fill, edge, label, turn }: { x: number; y: number; size: number; fill: string; edge: string; label: string; turn: number }) {
  return (
    <G transform={`rotate(${turn} ${x + size / 2} ${y + size / 2})`}>
      <Rect x={x} y={y + 3} width={size} height={size} rx={size * 0.22} fill={edge} />
      <Rect x={x} y={y} width={size} height={size} rx={size * 0.22} fill={fill} />
      <SvgText x={x + size / 2} y={y + size * 0.7} fontSize={size * 0.58} fontWeight="900" fill="#FFFFFF" textAnchor="middle">{label}</SvgText>
    </G>
  );
}

/**
 * The scene behind Owl: a tilted stage, the sun, a cloud, toy blocks and
 * sparkles. `bob` (0 → 1) lifts Owl gently; leave it out for a still Owl.
 */
export function OwlStage({ width, owlSize, bob, bubble, tint = 'sky', still }: { width: number; owlSize: number; bob?: Animated.Value; bubble?: string; still?: boolean; tint?: 'sky' | 'grass' | 'coral' | 'grape' | 'sun' }) {
  const height = width * 0.62;
  const stage = { sky: ['#5DA9F6', '#2F7BDB', '#A9D3FF'], grass: ['#5CC487', '#2F9A5B', '#B4E8C8'], coral: ['#FF8A73', '#E5533D', '#FFC9BC'], grape: ['#9B7EDE', '#7650C7', '#D9CCFA'], sun: ['#FFD25E', '#E0A514', '#FFF0B8'] }[tint];
  return (
    <View style={{ alignItems: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {bubble ? <View style={styles.bubble}><Text style={styles.bubbleText}>{bubble}</Text></View> : null}
      <View style={{ width, height }}>
        <Svg width={width} height={height} viewBox="0 0 300 186">
          {/* sun */}
          <Circle cx={258} cy={36} r={24} fill="#FFD84D" />
          <Circle cx={258} cy={36} r={32} fill="#FFD84D" opacity={0.25} />
          {/* cloud */}
          <G opacity={0.95}>
            <Ellipse cx={46} cy={40} rx={30} ry={14} fill="#FFFFFF" />
            <Ellipse cx={62} cy={30} rx={18} ry={14} fill="#FFFFFF" />
            <Ellipse cx={36} cy={32} rx={13} ry={10} fill="#FFFFFF" />
          </G>
          {/* the stage Owl stands on */}
          <G transform="rotate(-7 150 150)">
            <Rect x={52} y={128} width={196} height={50} rx={25} fill={stage[1]} />
            <Rect x={52} y={120} width={196} height={50} rx={25} fill={stage[0]} />
            <Rect x={70} y={128} width={160} height={14} rx={7} fill={stage[2]} opacity={0.7} />
          </G>
          <Block x={14} y={118} size={30} fill="#E5533D" edge="#B23A27" label="A" turn={-12} />
          <Block x={258} y={112} size={28} fill="#2F9A5B" edge="#1F7042" label="3" turn={10} />
          <Block x={40} y={84} size={20} fill="#7650C7" edge="#54369A" label="★" turn={14} />
          <Path d={sparkle(232, 84, 9)} fill="#FF7BAC" />
          <Path d={sparkle(80, 66, 7)} fill="#FFC83D" />
          <Path d={sparkle(214, 20, 6)} fill="#5DA9F6" />
          <Path d={sparkle(110, 14, 5)} fill="#7650C7" />
        </Svg>
        <Animated.View style={[styles.owlSpot, { bottom: height * 0.33, zIndex: 1, marginLeft: -owlSize / 2 },
          bob ? { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] } : null]}>
          <Owl size={owlSize} mood="happy" still={still} />
        </Animated.View>
      </View>
    </View>
  );
}

/** A full-width coloured band with a wavy top edge (and a wavy bottom edge with `bottom`). */
export function WaveBand({ colour, children, bottom }: { colour: string; children?: React.ReactNode; bottom?: boolean }) {
  return (
    <View>
      <Wave colour={colour} />
      <View style={{ backgroundColor: colour }}>{children}</View>
      {bottom ? <Wave colour={colour} down /> : null}
    </View>
  );
}

function Wave({ colour, down }: { colour: string; down?: boolean }) {
  return (
    <Svg width="100%" height={22} viewBox="0 0 400 22" preserveAspectRatio="none">
      <Path d={down ? 'M0 0 L0 10 Q50 22 100 10 T200 10 T300 10 T400 10 L400 0 Z' : 'M0 22 L0 12 Q50 0 100 12 T200 12 T300 12 T400 12 L400 22 Z'} fill={colour} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 999, justifyContent: 'center', alignItems: 'center' },
  whiteEdge: { borderWidth: 2.5 },
  sm: { minHeight: 44, paddingHorizontal: 16 },
  md: { minHeight: 52, paddingHorizontal: 22 },
  lg: { minHeight: 62, paddingHorizontal: 30 },
  off: { opacity: 0.55 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '900', textAlign: 'center' },
  textSm: { fontSize: 15 },
  textMd: { fontSize: 17 },
  textLg: { fontSize: 20 },
  ribbonRow: { position: 'absolute', top: -19, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  ribbon: { borderRadius: 999, borderBottomWidth: 4, paddingHorizontal: 18, paddingVertical: 7, maxWidth: '92%' },
  ribbonText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 999, borderWidth: 2.5, borderColor: '#FFC83D', paddingHorizontal: 16, paddingVertical: 6, marginBottom: -6, zIndex: 1 },
  bubbleText: { fontSize: 16, fontWeight: '900', color: '#7A4E08' },
  owlSpot: { position: 'absolute', left: '50%' },
});

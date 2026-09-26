import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { GameShape, GameThing } from '../types';
import { colors, scaled, spacing } from '../theme';
import type { GameProps } from './GameView';
import { styles as parts, useWiggle } from './parts';
import { playSound } from './sounds';

const SHAPE_COLORS = ['#E8724F', '#4A8FC4', '#3F9A6E', '#F2B441', '#8A6BC9', '#D9537A'];

export function ShapeIcon({ shape, size, color }: { shape: GameShape; size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {shape === 'circle' ? <Circle cx="50" cy="50" r="42" fill={color} />
        : shape === 'square' ? <Rect x="10" y="10" width="80" height="80" rx="8" fill={color} />
        : shape === 'triangle' ? <Path d="M50 8 L94 88 L6 88 Z" fill={color} strokeLinejoin="round" />
        : shape === 'star' ? <Path d="M50 6 L62 38 L96 38 L68 58 L79 92 L50 71 L21 92 L32 58 L4 38 L38 38 Z" fill={color} />
        : <Path d="M50 88 C20 66 6 50 6 32 C6 16 18 6 32 6 C41 6 47 11 50 18 C53 11 59 6 68 6 C82 6 94 16 94 32 C94 50 80 66 50 88 Z" fill={color} />}
    </Svg>
  );
}

/** A picture card: the emoji big, its word small underneath. Numbers show as numbers. */
function Card({ thing, s, big = 44 }: { thing: GameThing; s: number; big?: number }) {
  const isText = thing.emoji === thing.name;
  return (
    <View style={styles.cardInner}>
      <Text style={isText ? [styles.cardNumber, { fontSize: scaled(big * 0.8, s) }] : { fontSize: scaled(big, s) }}>{thing.emoji}</Text>
      {isText ? null : <Text style={styles.cardWord} numberOfLines={1}>{thing.name}</Text>}
    </View>
  );
}

/** One wiggling, tappable tile. */
function Tile({ children, onPress, disabled, state, label, style }: {
  children: React.ReactNode; onPress: () => void; disabled?: boolean; state: 'idle' | 'on' | 'tried' | 'right'; label: string; style?: object;
}) {
  const [shake, run] = useWiggle();
  useEffect(() => {
    if (state === 'tried') run();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={[style, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }] }]}>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
        style={({ pressed }) => [styles.tile, state === 'on' && styles.tileOn, state === 'right' && styles.tileRight, state === 'tried' && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.94 }] }]}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Tap all the shapes of one kind. */
export function ShapesGame({ spec, s, status, slip, finish }: GameProps<'shapes'>) {
  const [found, setFound] = useState<number[]>([]);
  const [shaking, setShaking] = useState<Record<number, number>>({});
  const colorsFor = useMemo(() => spec.shapes.map((_, i) => SHAPE_COLORS[(i * 7 + spec.shapes.length) % SHAPE_COLORS.length]!), [spec]);
  const tap = (i: number) => {
    if (status === 'right' || found.includes(i)) return;
    if (spec.shapes[i] === spec.target) {
      const next = [...found, i];
      setFound(next);
      playSound('pop');
      if (next.length === spec.answer.length) finish([...next].sort((a, b) => a - b));
    } else {
      setShaking(m => ({ ...m, [i]: (m[i] ?? 0) + 1 }));
      slip();
    }
  };
  const size = scaled(58, s);
  return (
    <View style={[parts.card, styles.grid3]}>
      {spec.shapes.map((shape, i) => (
        <ShakeOnChange key={i} token={shaking[i] ?? 0} style={styles.cell3}>
          <Pressable onPress={() => tap(i)} accessibilityRole="button" accessibilityLabel={shape}
            style={({ pressed }) => [styles.shapeCell, found.includes(i) && styles.tileRight, pressed && { transform: [{ scale: 0.92 }] }]}>
            <ShapeIcon shape={shape} size={size} color={colorsFor[i]!} />
            {found.includes(i) ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        </ShakeOnChange>
      ))}
    </View>
  );
}

/** Shakes its child whenever `token` changes. */
function ShakeOnChange({ token, children, style }: { token: number; children: React.ReactNode; style?: object }) {
  const [shake, run] = useWiggle();
  useEffect(() => { if (token > 0) run(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] }) }] }]}>{children}</Animated.View>;
}

/** What comes next in the pattern? */
export function PatternGame({ spec, s, status, pick, tried }: GameProps<'pattern'>) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.1, duration: 500, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]));
    if (status === 'playing' || status === 'tryagain') loop.start();
    return () => loop.stop();
  }, [status, pulse]);
  const size = scaled(34, s);
  const shownAnswer = status === 'right' || status === 'failed' ? spec.choices[spec.answer]?.emoji : null;
  return (
    <View>
      <View style={[parts.card, styles.patternRow]}>
        {spec.sequence.map((item, i) => <Text key={i} style={{ fontSize: size }}>{item.emoji}</Text>)}
        <Animated.View style={[styles.mystery, { width: size * 1.5, height: size * 1.5, transform: [{ scale: shownAnswer ? 1 : pulse }] }, shownAnswer ? styles.mysteryDone : null]}>
          <Text style={{ fontSize: shownAnswer ? size : size * 0.8, fontWeight: '900', color: colors.primary }}>{shownAnswer ?? '?'}</Text>
        </Animated.View>
      </View>
      <View style={styles.choiceRow}>
        {spec.choices.map((choice, i) => (
          <Tile key={i} onPress={() => pick(i)} disabled={status === 'right' || status === 'failed' || tried.includes(i)}
            state={(status === 'right' || status === 'failed') && i === spec.answer ? 'right' : tried.includes(i) ? 'tried' : 'idle'} label={choice.name}>
            <Text style={{ fontSize: scaled(44, s) }}>{choice.emoji}</Text>
          </Tile>
        ))}
      </View>
    </View>
  );
}

/** Which one does not belong? */
export function OddOneOutGame({ spec, s, status, pick, tried }: GameProps<'oddoneout'>) {
  return (
    <View style={styles.choiceRow}>
      {spec.items.map((item, i) => (
        <Tile key={i} onPress={() => pick(i)} disabled={status === 'right' || status === 'failed' || tried.includes(i)}
          state={(status === 'right' || status === 'failed') && i === spec.answer ? 'right' : tried.includes(i) ? 'tried' : 'idle'} label={item.name}>
          <Card thing={item} s={s} />
        </Tile>
      ))}
    </View>
  );
}

/** Tap the pictures in the right order; each gets its number. */
export function OrderGame({ spec, s, status, slip, finish }: GameProps<'order'>) {
  const [tapped, setTapped] = useState<number[]>([]);
  const [shaking, setShaking] = useState<Record<number, number>>({});
  const tap = (i: number) => {
    if (status === 'right' || tapped.includes(i)) return;
    if (spec.answer[tapped.length] === i) {
      const next = [...tapped, i];
      setTapped(next);
      playSound('pop');
      if (next.length === spec.items.length) finish(next);
    } else {
      setShaking(m => ({ ...m, [i]: (m[i] ?? 0) + 1 }));
      slip();
    }
  };
  return (
    <View>
      <View style={styles.choiceRow}>
        {spec.items.map((item, i) => {
          const at = tapped.indexOf(i);
          return (
            <ShakeOnChange key={i} token={shaking[i] ?? 0}>
              <Pressable onPress={() => tap(i)} accessibilityRole="button" accessibilityLabel={at >= 0 ? `${item.name}, number ${at + 1}` : item.name}
                style={({ pressed }) => [styles.tile, at >= 0 && styles.tileRight, pressed && { transform: [{ scale: 0.94 }] }]}>
                <Card thing={item} s={s} />
                {at >= 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{at + 1}</Text></View> : null}
              </Pressable>
            </ShakeOnChange>
          );
        })}
      </View>
      {tapped.length > 0 && tapped.length < spec.items.length ? (
        <Text style={styles.orderHint}>{['First', 'Next', 'Then', 'Last'][Math.min(tapped.length, 3)]}…</Text>
      ) : null}
    </View>
  );
}

/** Put each picture in its basket, by dragging it or by tapping it and then the basket. */
export function SortGame({ spec, s, status, slip, finish }: GameProps<'sort'>) {
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [basketShake, setBasketShake] = useState<[number, number]>([0, 0]);
  const basketRefs = [useRef<View>(null), useRef<View>(null)];
  const rects = useRef<Array<LayoutRectangle | null>>([null, null]);
  const placedRef = useRef(placed);
  placedRef.current = placed;

  const measure = () => basketRefs.forEach((ref, b) => ref.current?.measureInWindow((x, y, width, height) => { rects.current[b] = { x, y, width, height }; }));

  const drop = (item: number, basket: number) => {
    if (status === 'right' || placedRef.current[item] !== undefined) return;
    setSelected(null);
    if (spec.answer[item] === basket) {
      const next = { ...placedRef.current, [item]: basket };
      setPlaced(next);
      playSound('pop');
      if (Object.keys(next).length === spec.items.length) finish(spec.items.map((_, i) => next[i]!));
    } else {
      setBasketShake(t => (basket === 0 ? [t[0] + 1, t[1]] : [t[0], t[1] + 1]));
      slip();
    }
  };
  const basketAt = (pageX: number, pageY: number) => rects.current.findIndex(r => r && pageX >= r.x && pageX <= r.x + r.width && pageY >= r.y && pageY <= r.y + r.height);

  return (
    <View onLayout={measure}>
      <View style={[parts.card, styles.tray]}>
        {spec.items.map((item, i) => (placed[i] === undefined ? (
          <DragItem key={i} thing={item} s={s} selected={selected === i}
            onTap={() => { setSelected(selected === i ? null : i); playSound('flip'); }}
            onStart={measure}
            onDrop={(x, y) => { const b = basketAt(x, y); if (b >= 0) drop(i, b); }} />
        ) : null))}
        {Object.keys(placed).length === spec.items.length ? <Text style={styles.trayDone}>All sorted! 🎉</Text> : null}
      </View>
      <Text style={styles.orderHint}>{selected !== null ? `Now tap the basket for the ${spec.items[selected]!.name}` : 'Drag a picture to its basket, or tap it and then the basket'}</Text>
      <View style={styles.baskets}>
        {spec.baskets.map((basket, b) => (
          <ShakeOnChange key={b} token={basketShake[b]!} style={{ flex: 1 }}>
            <View ref={basketRefs[b]} collapsable={false}>
              <Pressable onPress={() => { if (selected !== null) drop(selected, b); }} accessibilityRole="button" accessibilityLabel={`${basket.name} basket`}
                style={({ pressed }) => [styles.basket, selected !== null && styles.basketReady, pressed && { transform: [{ scale: 0.97 }] }]}>
                <Text style={{ fontSize: scaled(32, s) }}>{basket.emoji}</Text>
                <Text style={styles.basketLabel}>{basket.name}</Text>
                <View style={styles.basketItems}>
                  {spec.items.map((item, i) => (placed[i] === b ? <Text key={i} style={{ fontSize: scaled(26, s) }}>{item.emoji}</Text> : null))}
                </View>
              </Pressable>
            </View>
          </ShakeOnChange>
        ))}
      </View>
    </View>
  );
}

function DragItem({ thing, s, selected, onTap, onStart, onDrop }: { thing: GameThing; s: number; selected: boolean; onTap: () => void; onStart: () => void; onDrop: (pageX: number, pageY: number) => void }) {
  const pos = useRef(new Animated.ValueXY()).current;
  const [dragging, setDragging] = useState(false);
  const handlers = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { setDragging(true); onStart(); },
    onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_e, g) => {
      setDragging(false);
      onDrop(g.moveX, g.moveY);
      Animated.spring(pos, { toValue: { x: 0, y: 0 }, friction: 6, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => { setDragging(false); Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(); },
  })).current;
  return (
    <Animated.View {...handlers.panHandlers} style={{ zIndex: dragging ? 10 : 1, transform: [...pos.getTranslateTransform(), { scale: dragging || selected ? 1.1 : 1 }] }}>
      <Pressable onPress={onTap} accessibilityRole="button" accessibilityLabel={`${thing.name}${selected ? ', picked up' : ''}`}
        style={[styles.tile, (selected || dragging) && styles.tileOn]}>
        <Card thing={thing} s={s} big={38} />
      </Pressable>
    </Animated.View>
  );
}

/** Memory: turn two cards over; find all the pairs. */
export function MatchGame({ spec, s, status, slip, finish }: GameProps<'match'>) {
  const deck = useMemo(() => {
    const cards = [...spec.pairs, ...spec.pairs].map((thing, i) => ({ thing, id: i }));
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j]!, cards[i]!]; }
    return cards;
  }, [spec]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const busy = useRef(false);
  const flip = (i: number) => {
    if (busy.current || status === 'right' || open.includes(i) || matched.includes(i)) return;
    playSound('flip');
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    const [a, b] = next as [number, number];
    if (deck[a]!.thing.emoji === deck[b]!.thing.emoji) {
      const done = [...matched, a, b];
      setMatched(done);
      setOpen([]);
      playSound('pop');
      if (done.length === deck.length) setTimeout(() => finish(null), 300);
    } else {
      busy.current = true;
      slip();
      setTimeout(() => { setOpen([]); busy.current = false; }, 850);
    }
  };
  const columns = deck.length <= 6 ? 3 : 4;
  const size = scaled(deck.length <= 6 ? 84 : 70, s);
  return (
    <View style={[parts.card, styles.matchGrid, { maxWidth: columns * (size + 10) + 24, alignSelf: 'center' }]}>
      {deck.map((card, i) => {
        const up = open.includes(i) || matched.includes(i);
        return (
          <Pressable key={card.id} testID={`memory-card-${i}`} onPress={() => flip(i)} accessibilityRole="button" accessibilityLabel={up ? card.thing.name : 'Hidden card'}
            style={({ pressed }) => [styles.memoryCard, { width: size, height: size }, up ? styles.memoryUp : styles.memoryDown, matched.includes(i) && styles.tileRight, pressed && { transform: [{ scale: 0.94 }] }]}>
            <Text style={{ fontSize: up ? size * 0.55 : size * 0.4, color: '#FFFFFF', fontWeight: '900' }}>{up ? card.thing.emoji : '?'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 2.5, borderColor: '#E3D4BF', padding: spacing(1), minWidth: 84, alignItems: 'center', justifyContent: 'center' },
  tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  tileRight: { borderColor: colors.go, backgroundColor: colors.goSoft, borderWidth: 3 },
  cardInner: { alignItems: 'center', gap: 2 },
  cardNumber: { fontWeight: '900', color: colors.ink, minWidth: 44, textAlign: 'center' },
  cardWord: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, maxWidth: 90 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(1.25), marginTop: spacing(2) },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cell3: { width: '33.33%', alignItems: 'center', padding: spacing(0.75) },
  shapeCell: { padding: spacing(1), borderRadius: 18, borderWidth: 2.5, borderColor: 'transparent' },
  check: { position: 'absolute', right: 2, top: 0, fontSize: 18, fontWeight: '900', color: colors.go },
  patternRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing(0.75) },
  mystery: { borderRadius: 14, borderWidth: 3, borderStyle: 'dashed', borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  mysteryDone: { borderStyle: 'solid', borderColor: colors.go, backgroundColor: colors.goSoft },
  badge: { position: 'absolute', top: -8, left: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  orderHint: { textAlign: 'center', marginTop: spacing(1.25), fontSize: 15, fontWeight: '800', color: colors.inkSoft },
  tray: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(1), minHeight: 96, overflow: 'visible' },
  trayDone: { fontSize: 18, fontWeight: '900', color: colors.go, alignSelf: 'center' },
  baskets: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(1.5) },
  basket: { minHeight: 150, borderRadius: 24, borderWidth: 3, borderColor: '#D9C8B0', borderStyle: 'dashed', backgroundColor: '#FFF6E8', alignItems: 'center', padding: spacing(1.25), gap: 4 },
  basketReady: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  basketLabel: { fontSize: 15, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  basketItems: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2 },
  matchGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  memoryCard: { borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  memoryDown: { backgroundColor: '#8A6BC9', borderColor: '#6B4BB0' },
  memoryUp: { backgroundColor: colors.surface, borderColor: '#E3D4BF' },
});

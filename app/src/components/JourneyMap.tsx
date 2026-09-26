import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TraitKey, TraitMetaPublic } from '../types';
import type { ChildProgress } from '../progress';
import { CATEGORY_NAMES, CATEGORY_VISUALS } from '../categoryVisuals';
import { colors, spacing } from '../theme';
import Owl from './Owl';

const ROW = 128;
const NODE = 74;
/** Where each stop sits across the path: left, middle, right, middle, … */
const LANES = [0.22, 0.5, 0.78, 0.5];

/**
 * The adventure map: one winding path per group of activities. Each stop is
 * an activity; the ones already played are coloured in with their stars, and
 * the owl stands on the last one played (or on the first, saying "Start here").
 */
export default function JourneyMap({ categories, progress, disabled, onOpen }: {
  categories: TraitMetaPublic[];
  progress: ChildProgress | null;
  disabled?: boolean;
  onOpen: (key: TraitKey) => void;
}) {
  const [width, setWidth] = useState(0);
  const points = categories.map((_, i) => ({ x: width * LANES[i % LANES.length]!, y: ROW * i + NODE / 2 + 30 }));
  const path = points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1]!;
    const midY = (prev.y + p.y) / 2;
    return `${d} C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
  }, '');
  // The owl stands on the stop played last; if that was in another group, it
  // waits at the first stop here not played yet, suggesting where to go next.
  const here = categories.findIndex(c => c.key === progress?.lastTrait);
  const nextUp = categories.findIndex(c => !(progress?.visited[c.key]?.plays));
  const owlAt = here >= 0 ? here : nextUp >= 0 ? nextUp : 0;
  const owlSays = here >= 0 ? null : nextUp < 0 ? null : categories.some(c => progress?.visited[c.key]?.plays) ? 'Try me!' : 'Start here!';
  const height = ROW * Math.max(1, categories.length) + 24;

  return (
    <View style={[styles.map, { height }]} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Path d={path} stroke="#E3CFAF" strokeWidth={14} fill="none" strokeLinecap="round" />
          <Path d={path} stroke="#FFFFFF" strokeWidth={4} fill="none" strokeDasharray="2 14" strokeLinecap="round" />
        </Svg>
      ) : null}
      {width > 0 ? categories.map((category, i) => {
        const visual = CATEGORY_VISUALS[category.key];
        const visit = progress?.visited[category.key];
        const played = (visit?.plays ?? 0) > 0;
        const p = points[i]!;
        return (
          <View key={category.key} style={[styles.stop, { left: p.x - 60, top: p.y - NODE / 2 }]}>
            {i === owlAt ? (
              <View style={[styles.owl, p.x > width * 0.6 ? { right: 96 } : { left: 96 }]}>
                <Owl mood="idle" size={50} />
                {owlSays ? <Text style={styles.startHere}>{owlSays}</Text> : null}
              </View>
            ) : null}
            <Pressable onPress={() => onOpen(category.key)} disabled={disabled}
              accessibilityRole="button" accessibilityLabel={`${CATEGORY_NAMES[category.key]}${played ? `, ${visit!.stars} stars` : ''}`}
              style={({ pressed }) => [styles.node, { borderColor: visual.border, backgroundColor: played ? visual.background : '#FFFFFF' }, pressed && { transform: [{ scale: 0.94 }] }]}>
              <Text style={[styles.nodeEmoji, !played && { opacity: 0.85 }]}>{visual.icon}</Text>
              {played ? <View style={styles.star}><Text style={styles.starText}>⭐{visit!.stars}</Text></View> : null}
            </Pressable>
            <Text style={styles.label} numberOfLines={2}>{CATEGORY_NAMES[category.key]}</Text>
          </View>
        );
      }) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', borderRadius: 28, backgroundColor: '#EAF6E9', borderWidth: 2, borderColor: '#BFE0C0', overflow: 'hidden' },
  stop: { position: 'absolute', width: 120, alignItems: 'center' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 4, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  nodeEmoji: { fontSize: 34 },
  star: { position: 'absolute', bottom: -8, backgroundColor: colors.happy, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, borderWidth: 2, borderColor: '#FFFFFF' },
  starText: { fontSize: 12, fontWeight: '900', color: '#5A3D05' },
  label: { marginTop: spacing(1), fontSize: 13, fontWeight: '900', color: colors.ink, textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  owl: { position: 'absolute', top: 6, alignItems: 'center', zIndex: 2 },
  startHere: { fontSize: 11, fontWeight: '900', color: '#4E3590', backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
});

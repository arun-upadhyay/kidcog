import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Cog from './Cog';
import { PLAY, type PlayColour } from './Playful';

/**
 * The KidCog name, drawn as a toy: every letter its own colour, bouncing a
 * little up and down, with Cog as the "o" and a star dotting the "i".
 * Plain text and views, so it is crisp at any size on iPhone, Android and web.
 * `size` is roughly the letter height in points. Pass `decorative` when the
 * parent (a button) already says "KidCog".
 */
const LETTERS: { ch: string; colour: PlayColour }[] = [
  { ch: 'K', colour: 'coral' },
  { ch: 'i', colour: 'sun' },
  { ch: 'd', colour: 'grass' },
  { ch: 'C', colour: 'sky' },
  { ch: 'o', colour: 'grape' },
  { ch: 'g', colour: 'grape' },
];

export default function Logo({ size = 28, decorative = false, tight = false }: { size?: number; decorative?: boolean; /** No room above and below (for the top bar). */ tight?: boolean }) {
  return (
    <View
      {...(decorative
        ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
        : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: 'KidCog' })}
      style={[styles.row, !tight && { paddingTop: size * 0.18, paddingBottom: size * 0.1 }]}
    >
      {LETTERS.map(({ ch, colour }, i) => {
        if (ch === 'o') {
          // Cog is the "o".
          return (
            <View key={i} style={{ marginHorizontal: size * 0.02, transform: [{ translateY: size * 0.08 }, { rotate: '-4deg' }] }}>
              <Cog size={size * 0.82} still outfit={null} mood="happy" />
            </View>
          );
        }
        const c = PLAY[colour];
        return (
          <View key={i} style={{ transform: [{ translateY: i % 2 === 0 ? 0 : -size * 0.1 }, { rotate: `${i % 2 === 0 ? -6 : 5}deg` }] }}>
            <Text
              style={[styles.letter, {
                fontSize: size * 1.12,
                lineHeight: size * 1.3,
                color: c.face,
                textShadowColor: c.lip,
                textShadowOffset: { width: 0, height: Math.max(2, size * 0.08) },
                textShadowRadius: 0.01,
              }]}
            >
              {/* A dotless i, so the star can be its dot. */}
              {ch === 'i' ? 'ı' : ch}
            </Text>
            {ch === 'i' ? <Text style={[styles.star, { fontSize: size * 0.42, top: -size * 0.12, left: -size * 0.06 }]}>⭐</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  letter: { fontWeight: '900', includeFontPadding: false },
  star: { position: 'absolute' },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Sheet from './Sheet';
import Owl from './Owl';
import Button from './Button';
import { colors, spacing } from '../theme';

/** After about 15 minutes of play: a friendly nudge to stretch, never a lock. */
export const BREAK_AFTER_MS = 15 * 60 * 1000;

export default function BreakSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} closeLabel="Okay">
      <View style={styles.body}>
        <Owl mood="happy" size={96} />
        <Text style={styles.title}>Time for a little break!</Text>
        <Text style={styles.text}>You’ve been playing for a while. Stand up, stretch up high 🙆, wiggle your fingers and have a drink of water. Your stars will be here when you come back!</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button title="Okay! 👍" onPress={onClose} uiScale={1.1} />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: spacing(1.5) },
  title: { fontSize: 22, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  text: { fontSize: 16, lineHeight: 23, color: colors.inkSoft, textAlign: 'center' },
});

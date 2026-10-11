import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { avatarEmoji } from '../avatars';

/**
 * Who is playing, and a big button to change player. Sits at the top of the
 * activity and Play Zone pages, so going back to "Who's playing today?" is
 * always one tap away (it used to hide at the bottom, or only in the ☰ menu).
 */
export default function PlayerBar({ name, avatar, onSwitch, left }: {
  name?: string; avatar?: string | null; onSwitch: () => void;
  /** Something to show at the start of the bar (a back button). */
  left?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const small = width < 430;
  return (
    <View style={styles.bar}>
      {left}
      <View style={styles.who} accessibilityLabel={name ? `${name} is playing` : 'Playing now'}>
        <View style={[styles.bubble, small && left ? { display: 'none' } : null]}><Text style={styles.avatar}>{avatarEmoji(avatar)}</Text></View>
        <Text style={styles.name} numberOfLines={1}>{name ? `${name}’s turn!` : 'Let’s play!'}</Text>
      </View>
      <Pressable onPress={onSwitch} accessibilityRole="button" accessibilityLabel="Switch player" hitSlop={6}
        style={({ pressed }) => [styles.switch, pressed && styles.pressed]}>
        <Text style={styles.switchIcon}>👥</Text>
        <Text style={styles.switchText}>{small ? 'Switch' : 'Switch player'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubble: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFC83D', alignItems: 'center', justifyContent: 'center' },
  avatar: { fontSize: 26 },
  name: { flexShrink: 1, fontSize: 18, fontWeight: '900', color: '#53347E' },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#B9A3EC' },
  switchIcon: { fontSize: 20 },
  switchText: { fontSize: 15, fontWeight: '900', color: '#53347E' },
  pressed: { transform: [{ scale: 0.95 }] },
});

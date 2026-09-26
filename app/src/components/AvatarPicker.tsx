import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Sheet from './Sheet';
import { colors, spacing } from '../theme';
import { AVATAR_GROUPS, FEATURED_AVATARS, avatarGroupOf, avatarName, avatarEmoji } from '../avatars';

type PickProps = { selected: string | null; onPick: (key: string) => void; busyKey?: string | null };

/** One round, tappable picture. The chosen one gets a ring and a tick. */
function Choice({ item, on, busy, onPress }: { item: { key: string; emoji: string; name: string }; on: boolean; busy: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={item.name}
      style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
    >
      <Text style={styles.choiceEmoji}>{busy ? '⏳' : item.emoji}</Text>
      {on ? <View style={styles.tick}><Text style={styles.tickText}>✓</Text></View> : null}
    </Pressable>
  );
}

/**
 * The whole library: group tabs across the top (Animals, Sea, Magic…) and the
 * pictures of the chosen group underneath.
 */
export function AvatarBrowser({ selected, onPick, busyKey = null }: PickProps) {
  const [group, setGroup] = useState(() => avatarGroupOf(selected));
  useEffect(() => { setGroup(avatarGroupOf(selected)); }, [selected]);
  const items = AVATAR_GROUPS.find(g => g.key === group)?.items ?? [];
  return (
    <View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {AVATAR_GROUPS.map(g => {
          const on = g.key === group;
          return (
            <Pressable
              key={g.key}
              onPress={() => setGroup(g.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={g.title}
              style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
            >
              <Text style={styles.tabIcon}>{g.icon}</Text>
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{g.title}</Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid} accessibilityRole="radiogroup">
        {items.map(item => (
          <Choice key={item.key} item={item} on={selected === item.key} busy={busyKey === item.key} onPress={() => onPick(item.key)} />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * For the add-a-child form: fifteen favourites right there, plus a "Browse" button
 * that opens the full library in a sheet.
 */
export function AvatarQuickPick({ selected, onPick }: PickProps) {
  const [browsing, setBrowsing] = useState(false);
  // If they picked something from "More", keep it visible in the row.
  const featured = selected && !FEATURED_AVATARS.some(f => f.key === selected)
    ? [...FEATURED_AVATARS.slice(0, FEATURED_AVATARS.length - 1), { key: selected, emoji: avatarEmoji(selected), name: avatarName(selected) }]
    : FEATURED_AVATARS;
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {featured.map(item => (
        <Choice key={item.key} item={item} on={selected === item.key} busy={false} onPress={() => onPick(item.key)} />
      ))}
      <Pressable
        onPress={() => setBrowsing(true)}
        accessibilityRole="button"
        accessibilityLabel="Browse more pictures"
        style={({ pressed }) => [styles.choice, styles.more, pressed && styles.pressed]}
      >
        <Text style={styles.morePlus}>🔍</Text>
        <Text style={styles.moreText}>Browse</Text>
      </Pressable>

      <Sheet visible={browsing} onClose={() => setBrowsing(false)} closeLabel="Close pictures">
        <Text style={styles.sheetTitle}>Browse pictures</Text>
        <AvatarBrowser selected={selected} onPick={(key) => { onPick(key); setBrowsing(false); }} />
        <Pressable onPress={() => setBrowsing(false)} accessibilityRole="button" style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), justifyContent: 'center', paddingVertical: spacing(0.75) },
  gridScroll: { maxHeight: 340 },
  choice: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF9F0', borderWidth: 2, borderColor: '#EEDFCB', alignItems: 'center', justifyContent: 'center' },
  choiceOn: { backgroundColor: colors.happySoft, borderColor: colors.happy, borderWidth: 3, transform: [{ scale: 1.08 }] },
  choiceEmoji: { fontSize: 32 },
  tick: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.go, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tickText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  more: { backgroundColor: '#FFFFFF', borderStyle: 'dashed', borderColor: colors.primary },
  morePlus: { fontSize: 18, lineHeight: 22 },
  moreText: { fontSize: 10, fontWeight: '900', color: colors.primary },
  // Tabs wrap rather than scroll sideways, so every group is visible with a mouse too.
  tabs: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(0.75), paddingBottom: spacing(1.5) },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing(0.6), paddingHorizontal: spacing(1.25), borderRadius: 999, backgroundColor: '#FFF9F0', borderWidth: 2, borderColor: '#EEDFCB' },
  tabOn: { backgroundColor: colors.happySoft, borderColor: colors.happy },
  tabIcon: { fontSize: 18 },
  tabText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  tabTextOn: { color: '#8A5A0A' },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#513A27', textAlign: 'center', marginBottom: spacing(1.5) },
  cancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1.5), borderRadius: 16, backgroundColor: colors.bg },
  cancelText: { fontSize: 16, fontWeight: '800', color: colors.inkSoft },
});

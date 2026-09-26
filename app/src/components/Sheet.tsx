import React from 'react';
import { Modal, View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, GUTTER, CONTENT_MAX_WIDTH } from '../theme';

/**
 * The app's pop-up panel. On a phone it slides up from the bottom (easy to
 * reach with a thumb); on a wider screen (tablet, desktop browser) it opens as
 * a card in the middle of the screen, where a bottom sheet looks out of place.
 * Tapping outside it, or the back button, closes it.
 */
export const CENTERED_FROM_WIDTH = 600;

export default function Sheet({ visible, onClose, children, closeLabel = 'Close' }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const centered = width >= CENTERED_FROM_WIDTH;
  return (
    <Modal visible={visible} transparent animationType={centered ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.root, centered && styles.rootCentered]}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} />
        <View
          accessibilityViewIsModal
          style={centered ? styles.card : [styles.bottom, { paddingBottom: insets.bottom + spacing(3) }]}
        >
          {centered ? null : <View style={styles.handle} />}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42,33,24,0.35)' },
  rootCentered: { justifyContent: 'center', alignItems: 'center', padding: spacing(3) },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  bottom: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center', maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: spacing(1.25), paddingHorizontal: GUTTER },
  card: { width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: colors.surface, borderRadius: 28, paddingVertical: spacing(3), paddingHorizontal: spacing(3), shadowColor: '#2A2118', shadowOpacity: 0.22, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: spacing(1.5) },
});

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '../screens/WelcomeScreen';

/** Viewport-wide reward, visible even when the answer is far down a scroll view. */export default function CorrectAnswerCelebration({ nonce, message = "You got it right!" }: { nonce: number; message?: string }) {
  const [visible, setVisible] = useState(false);
  const motion = useRef(new Animated.Value(0)).current;
  const still = useReduceMotion();
  useEffect(() => {
    if (!nonce) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1800);
    return () => clearTimeout(timer);
  }, [nonce]);
  useEffect(() => {
    motion.setValue(0);
    if (!visible || still) return;
    const animation = Animated.timing(motion, { toValue: 1, duration: 1700, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [visible, still, motion, nonce]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={() => setVisible(false)}>
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 30 }, (_, i) => <Animated.Text key={i} style={[styles.star, {
          left: `${4 + (i * 37) % 90}%`, top: `${3 + (i * 23) % 89}%`,
          fontSize: 24 + (i % 4) * 10, color: ['#FFCC32', '#F69536', '#9671DE'][i % 3],
          transform: still ? [] : [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [-45, 65] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '20deg'] }) }],
        }]}>★</Animated.Text>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Great job! Continue" onPress={() => setVisible(false)} style={styles.card}>
        <Text style={styles.bigStar}>🌟</Text>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>Great job!</Text>
        <Text style={styles.subtitle}>{message}</Text>
        <Text style={styles.hint}>Tap to continue</Text>
      </Pressable>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(255,249,233,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  star: { position: 'absolute' },
  card: { width: '100%', maxWidth: 440, padding: 28, borderRadius: 36, borderWidth: 4, borderColor: '#FFCC32', backgroundColor: '#FFFFFF', alignItems: 'center', gap: 8 },
  bigStar: { fontSize: 72 },
  title: { fontSize: 38, fontWeight: '900', color: '#52348B', textAlign: 'center' },
  subtitle: { fontSize: 23, fontWeight: '800', color: '#247343', textAlign: 'center' },
  hint: { marginTop: 12, fontSize: 15, color: '#665775' },
});

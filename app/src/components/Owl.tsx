import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import type { OwlOutfit } from '../progress';
import { OwlAccessories, useOwlOutfit } from './owlOutfits';

export type OwlMood = 'idle' | 'happy' | 'oops' | 'thinking';

/**
 * KidCog's owl, drawn from the app icon, reacting to what the child does:
 * bobbing while it waits, jumping for a right answer, a little head-tilt for
 * "almost". Plain SVG and the built-in Animated API, so it runs the same on
 * iPhone, Android and the web with no extra libraries.
 */
/**
 * `outfit`: what Owl wears. Left out, Owl wears the current child's outfit
 * (OwlOutfitContext); pass null for plain Owl.
 */
export default function Owl({ mood = 'idle', size = 72, outfit, still = false }: { mood?: OwlMood; size?: number; outfit?: OwlOutfit | null; /** No hop or bob (a calm, steady Owl). */ still?: boolean }) {
  const childOutfit = useOwlOutfit();
  const wearing = outfit === undefined ? childOutfit : outfit;
  const lift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);

  // Blink every few seconds, like it's alive.
  useEffect(() => {
    const timer = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    lift.stopAnimation();
    tilt.stopAnimation();
    tilt.setValue(0);
    let loop: Animated.CompositeAnimation | null = null;
    if (still) {
      lift.setValue(0);
    } else if (mood === 'happy') {
      Animated.sequence([
        Animated.timing(lift, { toValue: -size * 0.22, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 260, easing: Easing.bounce, useNativeDriver: true }),
        Animated.timing(lift, { toValue: -size * 0.12, duration: 150, useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 220, easing: Easing.bounce, useNativeDriver: true }),
      ]).start();
    } else if (mood === 'oops') {
      Animated.sequence([
        Animated.timing(tilt, { toValue: -1, duration: 120, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: -0.6, duration: 140, useNativeDriver: true }),
        Animated.timing(tilt, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    } else if (mood === 'thinking') {
      Animated.timing(tilt, { toValue: 0.7, duration: 300, useNativeDriver: true }).start();
    } else {
      loop = Animated.loop(Animated.sequence([
        Animated.timing(lift, { toValue: -size * 0.05, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(lift, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]));
      loop.start();
    }
    return () => loop?.stop();
  }, [mood, lift, tilt, size, still]);

  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] });
  const happy = mood === 'happy';
  const closed = blink && !happy;
  return (
    <View style={{ width: size, height: size * 1.1, pointerEvents: 'none' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ transform: [{ translateY: lift }, { rotate }] }}>
        <Svg width={size} height={size * 1.1} viewBox="180 130 664 800">
          <Path d="M268 360 L300 150 L430 300 Z" fill="#8A6BC9" />
          <Path d="M756 360 L724 150 L594 300 Z" fill="#8A6BC9" />
          <Ellipse cx="512" cy="590" rx="318" ry="330" fill="#6B4BB0" />
          <Ellipse cx="512" cy="660" rx="210" ry="230" fill="#FFF3DC" />
          <Path d="M430 760 q41 40 82 0 q41 40 82 0" fill="none" stroke="#F2B441" strokeWidth={22} strokeLinecap="round" />
          <Circle cx="392" cy="520" r="128" fill="#FFFFFF" stroke="#4E3590" strokeWidth={22} />
          <Circle cx="632" cy="520" r="128" fill="#FFFFFF" stroke="#4E3590" strokeWidth={22} />
          {happy ? (
            <>
              <Path d="M340 540 q52 -70 104 0" fill="none" stroke="#2A2118" strokeWidth={30} strokeLinecap="round" />
              <Path d="M580 540 q52 -70 104 0" fill="none" stroke="#2A2118" strokeWidth={30} strokeLinecap="round" />
            </>
          ) : closed ? (
            <>
              <Path d="M340 530 h104" stroke="#2A2118" strokeWidth={26} strokeLinecap="round" />
              <Path d="M580 530 h104" stroke="#2A2118" strokeWidth={26} strokeLinecap="round" />
            </>
          ) : (
            <>
              <Circle cx={mood === 'thinking' ? 420 : 404} cy={mood === 'thinking' ? 500 : 530} r="62" fill="#2A2118" />
              <Circle cx={mood === 'thinking' ? 648 : 620} cy={mood === 'thinking' ? 500 : 530} r="62" fill="#2A2118" />
              <Circle cx="426" cy="506" r="20" fill="#FFFFFF" />
              <Circle cx="642" cy="506" r="20" fill="#FFFFFF" />
            </>
          )}
          <Path d="M470 640 L554 640 L512 712 Z" fill="#E8724F" stroke="#E8724F" strokeWidth={18} strokeLinejoin="round" />
          {mood === 'oops' ? <Path d="M470 740 q42 -26 84 0" fill="none" stroke="#4E3590" strokeWidth={16} strokeLinecap="round" /> : null}
          {wearing ? <OwlAccessories outfit={wearing} /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

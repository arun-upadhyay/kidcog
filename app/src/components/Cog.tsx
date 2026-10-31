import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { CogOutfit } from '../progress';
import { CogAccessories, useCogOutfit } from './cogOutfits';

export type CogMood = 'idle' | 'happy' | 'oops' | 'thinking';

/**
 * Cog, KidCog's own mascot: a bright, round gear with a friendly face and a
 * thinking spark on top — the "cog" in KidCog. Original artwork made for
 * KidCog (see assets/BRAND.md); simple bold shapes and bright colours so
 * young children recognise it at any size.
 *
 * Cog reacts to what the child does: bobbing while it waits, jumping for a
 * right answer, a little wobble for "almost", a head-tilt while thinking.
 * Plain SVG and the built-in Animated API, so it runs the same on iPhone,
 * Android and the web.
 *
 * Drawn in the same box the dress-up items use (viewBox 180 130 664 800, eyes
 * at (392, 520) and (632, 520)), so hats, glasses and bows fit Cog too.
 * `outfit`: what Cog wears. Left out, Cog wears the current child's outfit
 * (CogOutfitContext); pass null for plain Cog.
 */
const GEAR = 'M459.2 365.7 L468.8 313.2 L555.2 313.2 L564.8 365.7 L626.0 388.0 L667.1 353.9 L733.3 409.5 L706.9 455.9 L739.4 512.3 L792.9 512.6 L807.9 597.7 L757.8 616.3 L746.5 680.4 L787.2 715.0 L744.0 789.9 L693.7 771.9 L643.8 813.7 L652.8 866.4 L571.5 896.0 L544.5 849.8 L479.5 849.8 L452.5 896.0 L371.2 866.4 L380.2 813.7 L330.3 771.9 L280.0 789.9 L236.8 715.0 L277.5 680.4 L266.2 616.3 L216.1 597.7 L231.1 512.6 L284.6 512.3 L317.1 455.9 L290.7 409.5 L356.9 353.9 L398.0 388.0 Z';
export const COG_COLOURS = { gear: '#FF9F1C', rim: '#FFB547', face: '#FFF4DC', ink: '#3D2C8D', spark: '#FFD23F', sparkEdge: '#F2A900', cheek: '#FF8FA3' };

export default function Cog({ mood = 'idle', size = 72, outfit, still = false, talking = false }: { talking?: boolean; mood?: CogMood; size?: number; outfit?: CogOutfit | null; /** No hop or bob (a calm, steady Cog). */ still?: boolean }) {
  const childOutfit = useCogOutfit();
  const wearing = outfit === undefined ? childOutfit : outfit;
  const lift = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  useEffect(() => {
    setMouthOpen(false);
    if (!talking || still) return;
    const timer = setInterval(() => setMouthOpen(v => !v), 180);
    return () => clearInterval(timer);
  }, [talking, still]);

  // Blink every few seconds, like it's alive.
  useEffect(() => {
    if (still) { setBlink(false); return; }
    let blinkTimer: ReturnType<typeof setTimeout>;
    const timer = setInterval(() => {
      setBlink(true);
      blinkTimer = setTimeout(() => setBlink(false), 140);
    }, 3200);
    return () => { clearInterval(timer); clearTimeout(blinkTimer); };
  }, [still]);

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
  const c = COG_COLOURS;
  return (
    <View style={{ width: size, height: size * 1.1, pointerEvents: 'none' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ transform: [{ translateY: lift }, { rotate }] }}>
        <Svg width={size} height={size * 1.1} viewBox="180 130 664 800">
          {/* gear body: teeth softened by a thick round-cornered outline of the same colour */}
          <Path d={GEAR} fill={c.gear} stroke={c.gear} strokeWidth={44} strokeLinejoin="round" />
          <Circle cx="512" cy="606" r="246" fill={c.rim} />
          <Circle cx="512" cy="622" r="206" fill={c.face} />
          {/* the thinking spark (tucked away under a hat) */}
          {wearing?.hat ? null : (
            <Path d="M512 196 L530 250 L586 262 L530 276 L512 330 L494 276 L438 262 L494 250 Z" fill={mood === 'thinking' ? '#FFF3A0' : c.spark} stroke={c.sparkEdge} strokeWidth={10} strokeLinejoin="round" />
          )}
          {/* eyes */}
          <Circle cx="392" cy="520" r="104" fill="#FFFFFF" stroke={c.ink} strokeWidth={14} />
          <Circle cx="632" cy="520" r="104" fill="#FFFFFF" stroke={c.ink} strokeWidth={14} />
          {happy ? (
            <>
              <Path d="M344 540 q48 -64 96 0" fill="none" stroke="#2A2118" strokeWidth={28} strokeLinecap="round" />
              <Path d="M584 540 q48 -64 96 0" fill="none" stroke="#2A2118" strokeWidth={28} strokeLinecap="round" />
            </>
          ) : closed ? (
            <>
              <Path d="M344 528 h96" stroke="#2A2118" strokeWidth={24} strokeLinecap="round" />
              <Path d="M584 528 h96" stroke="#2A2118" strokeWidth={24} strokeLinecap="round" />
            </>
          ) : (
            <>
              <Circle cx={mood === 'thinking' ? 418 : 402} cy={mood === 'thinking' ? 500 : 530} r="54" fill="#2A2118" />
              <Circle cx={mood === 'thinking' ? 646 : 622} cy={mood === 'thinking' ? 500 : 530} r="54" fill="#2A2118" />
              <Circle cx="422" cy="508" r="17" fill="#FFFFFF" />
              <Circle cx="642" cy="508" r="17" fill="#FFFFFF" />
            </>
          )}
          {/* rosy cheeks and the mouth */}
          <Circle cx="344" cy="700" r="38" fill={c.cheek} opacity={0.75} />
          <Circle cx="680" cy="700" r="38" fill={c.cheek} opacity={0.75} />
          {mouthOpen ? (
            <Path d="M462 690 q50 70 100 0 Z" fill={c.ink} stroke={c.ink} strokeWidth={14} strokeLinejoin="round" />
          ) : mood === 'oops' ? (
            <Path d="M466 728 q46 -30 92 0" fill="none" stroke={c.ink} strokeWidth={22} strokeLinecap="round" />
          ) : mood === 'thinking' ? (
            <Path d="M478 714 h68" stroke={c.ink} strokeWidth={22} strokeLinecap="round" />
          ) : (
            <Path d="M452 694 q60 56 120 0" fill="none" stroke={c.ink} strokeWidth={24} strokeLinecap="round" />
          )}
          {wearing ? <CogAccessories outfit={wearing} /> : null}
        </Svg>
      </Animated.View>
    </View>
  );
}

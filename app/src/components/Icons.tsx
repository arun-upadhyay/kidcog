import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The two icons people already know from every phone: a microphone for
 * "you talk", a speaker for "you listen". Drawn as vectors (Material Icons
 * shapes, Apache 2.0) so they look the same on iPhone, Android and the web,
 * unlike emoji, which every system draws differently.
 */
type IconProps = { size?: number; color?: string };

/**
 * Icons are decoration: the button around them carries the spoken label.
 * The hide-from-screen-reader settings live on this View (which understands
 * them on every platform) rather than on the Svg, which on the web would pass
 * them to the browser as unknown attributes and log a warning.
 */
function Hidden({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <View
      style={{ width: size, height: size, pointerEvents: 'none' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      {children}
    </View>
  );
}

export function MicIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
      </Svg>
    </Hidden>
  );
}

export function SpeakerIcon({ size = 24, color = '#FFFFFF' }: IconProps) {
  return (
    <Hidden size={size}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </Svg>
    </Hidden>
  );
}

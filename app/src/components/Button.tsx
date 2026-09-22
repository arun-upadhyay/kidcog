import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, spacing, scaled } from '../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  /** From the age profile: grows the target for smaller, less accurate fingers. */
  uiScale?: number;
}

export default function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  uiScale = 1,
}: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { minHeight: scaled(52, uiScale), borderRadius: scaled(14, uiScale) },
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.inner}>
        {loading && (
          <ActivityIndicator
            color={isPrimary ? '#fff' : colors.accent}
            style={{ marginRight: 8 }}
          />
        )}
        <Text
          style={[
            styles.text,
            { fontSize: scaled(16, uiScale) },
            isPrimary ? styles.textPrimary : styles.textSecondary,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    borderRadius: 14,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.line },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  text: { fontSize: 16, fontWeight: '700' },
  textPrimary: { color: '#fff' },
  textSecondary: { color: colors.ink },
});

import { useCallback, useEffect, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const listeners = new Set<(collapsed: boolean) => void>();
let collapsed = false;

/** One shared state for the signed-in app bar, regardless of which screen scrolls. */
export function setAppHeaderCollapsed(next: boolean) {
  if (collapsed === next) return;
  collapsed = next;
  listeners.forEach(listener => listener(next));
}

export function useAppHeaderCollapsed() {
  const [value, setValue] = useState(collapsed);
  useEffect(() => {
    listeners.add(setValue);
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}

/** Attach this to a screen's main vertical ScrollView. */
export function useAppHeaderScroll(threshold = 24) {
  useEffect(() => {
    setAppHeaderCollapsed(false);
    return () => setAppHeaderCollapsed(false);
  }, []);
  return useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setAppHeaderCollapsed(event.nativeEvent.contentOffset.y > threshold);
  }, [threshold]);
}

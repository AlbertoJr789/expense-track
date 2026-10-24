import { useEffect, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

export function RevealItem({ index, play, children }: { index: number; play: number; children: ReactNode }) {
  const opacity = useSharedValue(0);
  const shift = useSharedValue(14);

  useEffect(() => {
    const easing = Easing.out(Easing.cubic);
    const delay = Math.min(index, 16) * 46;
    opacity.value = 0;
    shift.value = 14;
    opacity.value = withDelay(delay, withTiming(1, { duration: 300, easing }));
    shift.value = withDelay(delay, withTiming(0, { duration: 300, easing }));
  }, [index, opacity, play, shift]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: shift.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

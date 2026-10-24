import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function SkeletonList({ rows = 6 }: { rows?: number }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.title,
          { backgroundColor: theme.backgroundElement },
          pulse,
        ]}
      />
      {Array.from({ length: rows }, (_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.row,
            { backgroundColor: theme.backgroundElement },
            pulse,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  title: { height: 28, width: "46%", borderRadius: Spacing.two },
  row: { height: 72, borderRadius: Spacing.three },
});

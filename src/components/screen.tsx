import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomMenu } from "@/components/bottom-menu";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function Screen({
  title,
  right,
  children,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const opacity = useSharedValue(0);
  const shift = useSharedValue(12);

  useFocusEffect(
    useCallback(() => {
      const easing = Easing.out(Easing.cubic);
      opacity.value = 0;
      shift.value = 12;
      opacity.value = withTiming(1, { duration: 320, easing });
      shift.value = withTiming(0, { duration: 320, easing });
    }, [opacity, shift]),
  );

  const fade = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: shift.value }],
  }));

  function openMenu() {
    const current = navigation as {
      openDrawer?: () => void;
      getParent?: () => { openDrawer?: () => void } | undefined;
    };
    if (typeof current.openDrawer === "function") {
      current.openDrawer();
      return;
    }
    current.getParent?.()?.openDrawer?.();
  }

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.stage, fade]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={openMenu}
            style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
          >
            <Ionicons name="menu" size={26} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title} numberOfLines={1}>
            {title}
          </ThemedText>
          {right}
        </View>
        <View style={styles.body}>{children}</View>
      </Animated.View>
      <BottomMenu />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  stage: { flex: 1 },
  pressed: { opacity: 0.6 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  menu: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: "700" },
  body: { flex: 1 },
});

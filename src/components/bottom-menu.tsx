import { router, usePathname, type Href } from 'expo-router';
import { useDrawerStatus } from 'expo-router/drawer';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type Section = 'organization' | 'month' | 'tracking';

const HOME: Record<Section, string> = {
  organization: '/chart-of-accounts',
  month: '/',
  tracking: '/timeline',
};

const lastHref: Record<Section, string> = { ...HOME };

const ORGANIZATION = new Set(['/chart-of-accounts', '/incomes', '/expenses', '/balance-sheet', '/goals']);
const TRACKING = new Set(['/timeline', '/radiography', '/lifestyle']);

const CENTER_SIZE = 68;

function normalize(path: string) {
  const clean = path.split('?')[0].split('#')[0];
  if (clean === '' || clean === '/index') return '/';
  return clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
}

function sectionOf(path: string): Section | null {
  if (path === '/') return 'month';
  if (ORGANIZATION.has(path)) return 'organization';
  if (TRACKING.has(path)) return 'tracking';
  return null;
}

export function BottomMenu() {
  const pathname = normalize(usePathname());
  const drawerStatus = useDrawerStatus();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { __ } = useI18n();
  const current = sectionOf(pathname);
  const monthLift = useSharedValue(current === 'month' ? 1 : 0);

  useEffect(() => {
    if (current) lastHref[current] = pathname;
  }, [current, pathname]);

  useEffect(() => {
    monthLift.value = withTiming(current === 'month' ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [current, monthLift]);

  const centerMotion = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(monthLift.value, [0, 1], [-26, -30]) },
      { scale: interpolate(monthLift.value, [0, 1], [1, 1.04]) },
    ],
  }));

  if (drawerStatus === 'open') return null;

  function open(section: Section) {
    const href = lastHref[section];
    if (href === pathname) return;
    router.navigate(href as Href);
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barOuter, { paddingBottom: insets.bottom + Spacing.two }]}>
      <View style={[styles.bar, { backgroundColor: colors.backgroundElement, shadowColor: '#000' }]}>
        <SideTab
          label={__('nav.tab.organization')}
          selected={current === 'organization'}
          onPress={() => open('organization')}
        />
        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.centerButton,
              centerMotion,
              { backgroundColor: theme.accent, borderColor: colors.background, shadowColor: theme.accent },
            ]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: current === 'month' }}
              onPress={() => open('month')}
              style={({ pressed }) => [styles.centerHit, pressed && styles.pressed]}>
              <ThemedText style={styles.centerLabel}>{__('nav.tab.month')}</ThemedText>
              <ThemedText style={styles.centerSublabel}>{__('nav.tab.month_sub')}</ThemedText>
            </Pressable>
          </Animated.View>
        </View>
        <SideTab
          label={__('nav.tab.tracking')}
          selected={current === 'tracking'}
          onPress={() => open('tracking')}
        />
      </View>
    </View>
  );
}

function FocusDot({ selected, color }: { selected: boolean; color: string }) {
  const shown = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(selected ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [selected, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scale: interpolate(shown.value, [0, 1], [0.3, 1]) }],
  }));
  return <Animated.View style={[styles.sideDot, { backgroundColor: color }, style]} />;
}

function SideTab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.sideTab, pressed && styles.pressed]}>
      <FocusDot selected={selected} color={theme.accent} />
      <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'} style={styles.sideLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  barOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 60,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
      default: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  sideTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  sideLabel: { textAlign: 'center' },
  sideDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  centerWrap: {
    width: CENTER_SIZE + Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
      default: {
        boxShadow: '0 6px 10px rgba(26, 122, 76, 0.35)',
      },
    }),
  },
  centerHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 17,
  },
  centerSublabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  pressed: { opacity: 0.75 },
});

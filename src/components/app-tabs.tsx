import { Tabs, TabList, TabListProps, TabSlot, TabTrigger, TabTriggerSlotProps } from 'expo-router/ui';
import { Ref } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <TabBar bottomInset={insets.bottom}>
          <TabTrigger name="lancamentos" href="/lancamentos" asChild>
            <SideTab label="Lançamentos" />
          </TabTrigger>
          <TabTrigger name="index" href="/" asChild>
            <CenterTab label="Mês" sublabel="Atual" />
          </TabTrigger>
          <TabTrigger name="charts" href="/charts" asChild>
            <SideTab label="Acompanhamento" />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({
  bottomInset,
  children,
  style,
  ...props
}: TabListProps & { bottomInset: number }) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View
      {...props}
      style={[styles.barOuter, { paddingBottom: bottomInset + Spacing.two }, style]}
      pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.backgroundElement,
            shadowColor: '#000',
          },
        ]}>
        {children}
      </View>
    </View>
  );
}

type SideTabProps = TabTriggerSlotProps & { label: string; ref?: Ref<View> };

function SideTab({ label, isFocused, ...props }: SideTabProps) {
  const theme = useTheme();
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.sideTab, pressed && styles.pressed]}>
      <View
        style={[
          styles.sideDot,
          { backgroundColor: isFocused ? theme.accent : 'transparent' },
        ]}
      />
      <ThemedText
        type={isFocused ? 'smallBold' : 'small'}
        themeColor={isFocused ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type CenterTabProps = TabTriggerSlotProps & {
  label: string;
  sublabel: string;
  ref?: Ref<View>;
};

function CenterTab({ label, sublabel, isFocused, ...props }: CenterTabProps) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <View style={styles.centerWrap} pointerEvents="box-none">
      <Pressable
        {...props}
        style={({ pressed }) => [
          styles.centerButton,
          {
            backgroundColor: theme.accent,
            borderColor: colors.background,
            shadowColor: theme.accent,
          },
          isFocused && styles.centerFocused,
          pressed && styles.pressed,
        ]}>
        <ThemedText style={[styles.centerLabel, { color: '#fff' }]}>{label}</ThemedText>
        <ThemedText style={[styles.centerSublabel, { color: '#fff' }]}>{sublabel}</ThemedText>
      </Pressable>
    </View>
  );
}

const CENTER_SIZE = 68;

const styles = StyleSheet.create({
  slot: { height: '100%' },
  barOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
      default: {},
    }),
  },
  sideTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
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
    transform: [{ translateY: -26 }],
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
      default: {},
    }),
  },
  centerFocused: {
    transform: [{ translateY: -30 }, { scale: 1.04 }],
  },
  centerLabel: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 17,
  },
  centerSublabel: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
  },
  pressed: { opacity: 0.75 },
});

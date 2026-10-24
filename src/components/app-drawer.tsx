import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useDrawerProgress, type DrawerContentComponentProps } from 'expo-router/drawer';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type Locale } from '@/i18n';

type Item = { route: string; label: string };

export function AppDrawer({ navigation, state }: DrawerContentComponentProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { __, locale, setLocale } = useI18n();
  const { exportBackup, importBackup } = useData();
  const [busy, setBusy] = useState(false);
  const current = state.routes[state.index]?.name;
  const progress = useDrawerProgress();
  const motion = useAnimatedStyle(() => ({
    flex: 1,
    opacity: interpolate(progress.value, [0, 0.45, 1], [0, 0.72, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-18, 0]) }],
  }));

  const sections: { title: string; items: Item[] }[] = [
    {
      title: __('nav.organization'),
      items: [
        { route: 'chart-of-accounts', label: __('nav.chart') },
        { route: 'incomes', label: __('nav.incomes') },
        { route: 'expenses', label: __('nav.expenses') },
        { route: 'balance-sheet', label: __('nav.balance') },
        { route: 'goals', label: __('nav.goals') },
      ],
    },
    { title: __('nav.month'), items: [{ route: 'index', label: __('nav.month') }] },
    {
      title: __('nav.tracking'),
      items: [
        { route: 'timeline', label: __('nav.timeline') },
        { route: 'radiography', label: __('nav.radiography') },
        { route: 'lifestyle', label: __('nav.lifestyle') },
      ],
    },
  ];

  function go(route: string) {
    const href = route === 'index' ? '/' : `/${route}`;
    router.navigate(href as Href);
    navigation.closeDrawer();
  }

  async function onExport() {
    setBusy(true);
    try {
      await exportBackup();
    } catch (error) {
      Alert.alert(__('backup.export_error'), error instanceof Error ? error.message : __('common.try_again'));
    } finally {
      setBusy(false);
    }
  }

  function onImport() {
    Alert.alert(__('backup.import_title'), __('backup.import_body'), [
      { text: __('common.cancel'), style: 'cancel' },
      {
        text: __('backup.import_action'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const imported = await importBackup();
            if (imported) Alert.alert(__('backup.imported'), __('backup.imported_body'));
          } catch (error) {
            Alert.alert(
              __('backup.import_error'),
              error instanceof Error ? error.message : __('backup.invalid_file')
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.drawer, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.three }]}>
      <Animated.View style={motion}>
      <View style={styles.brandRow}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} contentFit="cover" />
        <ThemedText type="subtitle" style={styles.brand}>
          {__('app.name')}
        </ThemedText>
      </View>
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {section.title}
            </ThemedText>
            {section.items.map((item) => {
              const selected = current === item.route;
              return (
                <Pressable
                  key={item.route}
                  onPress={() => go(item.route)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: selected || pressed ? theme.backgroundElement : 'transparent',
                      opacity: pressed ? 0.72 : 1,
                    },
                  ]}>
                  <ThemedText type={selected ? 'smallBold' : 'small'}>{item.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {__('nav.language')}
        </ThemedText>
        <View style={styles.langs}>
          {(['pt', 'en'] as Locale[]).map((code) => (
            <Pressable
              key={code}
              onPress={() => setLocale(code)}
              style={[
                styles.lang,
                { backgroundColor: locale === code ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText type="smallBold" style={{ color: locale === code ? '#fff' : theme.text }}>
                {code.toUpperCase()}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        <Pressable disabled={busy} onPress={onExport} style={styles.backup}>
          <Ionicons name="download-outline" size={18} color={theme.text} />
          <ThemedText type="small">{__('backup.export')}</ThemedText>
        </Pressable>
        <Pressable disabled={busy} onPress={onImport} style={styles.backup}>
          <Ionicons name="cloud-upload-outline" size={18} color={theme.text} />
          <ThemedText type="small">{__('backup.import')}</ThemedText>
        </Pressable>
      </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: { flex: 1, paddingHorizontal: Spacing.three },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.three },
  logo: { width: 48, height: 48, borderRadius: 14 },
  brand: { flex: 1, fontSize: 26, lineHeight: 32 },
  listScroll: { flex: 1 },
  list: { gap: Spacing.three, paddingBottom: Spacing.four },
  section: { gap: Spacing.one },
  item: { borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  footer: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.35)', paddingTop: Spacing.three },
  langs: { flexDirection: 'row', gap: Spacing.two },
  lang: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.two },
  backup: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
});

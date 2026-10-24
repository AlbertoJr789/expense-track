import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

const PAGE_SIZE = 12;

export function SectionAccordion<T>({
  title,
  note,
  total,
  items,
  filterItem,
  keyExtractor,
  renderItem,
  onAdd,
  addLabel,
  emptyLabel,
  expanded,
  onToggle,
  viewportBottom,
  origin = 0,
}: {
  title: string;
  note?: string;
  total?: string;
  items: T[];
  filterItem: (item: T, query: string) => boolean;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onAdd: () => void;
  addLabel: string;
  emptyLabel: string;
  expanded: boolean;
  onToggle: () => void;
  /** Distância do topo do conteúdo até o fim da área visível. */
  viewportBottom: number;
  /** Deslocamento do pai em relação ao conteúdo rolável. */
  origin?: number;
}) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(PAGE_SIZE);
  const layout = useRef({ y: 0, height: 0 });
  const loadedBottom = useRef(-1);
  const measured = useSharedValue(0);
  const progress = useSharedValue(expanded ? 1 : 0);
  const openedOnce = useRef(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => filterItem(item, q));
  }, [items, query, filterItem]);

  useEffect(() => {
    setCount(PAGE_SIZE);
  }, [query]);

  useEffect(() => {
    if (!openedOnce.current) return;
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, progress]);

  const clipStyle = useAnimatedStyle(() => ({
    height: measured.value * progress.value,
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 1]),
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 90])}deg` }],
  }));

  function revealMore(bottom: number) {
    if (!expanded || bottom <= 0 || count >= filtered.length) return;
    if (bottom > viewportBottom + 180) return;
    if (loadedBottom.current === bottom) return;
    loadedBottom.current = bottom;
    setCount((current) => current + PAGE_SIZE);
  }

  useEffect(() => {
    revealMore(origin + layout.current.y + layout.current.height);
  }, [viewportBottom, count, expanded, filtered.length, origin]);

  function onLayout(event: LayoutChangeEvent) {
    const { y, height } = event.nativeEvent.layout;
    layout.current = { y, height };
    revealMore(origin + y + height);
  }

  const visible = filtered.slice(0, count);

  return (
    <View onLayout={onLayout} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-forward" size={18} color={theme.text} />
        </Animated.View>
        <ThemedText type="smallBold" style={styles.title}>
          {title}
        </ThemedText>
        {total ? <ThemedText type="smallBold">{total}</ThemedText> : null}
      </Pressable>
      <Animated.View style={[styles.clip, clipStyle]} pointerEvents={expanded ? 'auto' : 'none'}>
        <View
          style={styles.measure}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            measured.value = height;
            if (!openedOnce.current) {
              openedOnce.current = true;
              progress.value = expanded ? 1 : 0;
            }
          }}>
        <View style={styles.body}>
          <View style={[styles.search, { backgroundColor: theme.background }]}>
            <Ionicons name="search" size={16} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={__('common.search')}
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              returnKeyType="search"
            />
          </View>
          {note ? (
            <ThemedText type="small" themeColor="textSecondary">
              {note}
            </ThemedText>
          ) : null}
          {visible.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {query.trim() ? __('common.empty_search') : emptyLabel}
            </ThemedText>
          ) : (
            visible.map((item) => <View key={keyExtractor(item)}>{renderItem(item)}</View>)
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onAdd}
            style={[styles.add, { backgroundColor: theme.background }]}>
            <Ionicons name="add" size={18} color={theme.text} />
            <ThemedText type="smallBold">{addLabel}</ThemedText>
          </Pressable>
        </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Spacing.three, overflow: 'hidden' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  title: { flex: 1 },
  pressed: { opacity: 0.72 },
  clip: { overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, right: 0 },
  body: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  search: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  searchInput: { flex: 1, height: '100%', paddingVertical: 0, fontSize: 16 },
  add: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
});

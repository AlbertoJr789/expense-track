import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupFormModal } from '@/components/group-form-modal';
import { RevealItem } from '@/components/reveal-item';
import { Screen } from '@/components/screen';
import { SkeletonList } from '@/components/skeleton';
import { SwipeRow } from '@/components/swipe-row';
import { ThemedText } from '@/components/themed-text';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { BankAccount, Group, GroupKind, PaymentMethod } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

import { NameModal } from '@/components/name-modal';

type Segment = 'categories' | 'payments' | 'accounts';

export default function ChartOfAccountsScreen() {
  const { __ } = useI18n();
  const { ready } = useData();
  const [segment, setSegment] = useState<Segment>('categories');
  const [play, setPlay] = useState(0);
  const seen = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!seen.current) {
        seen.current = true;
        return;
      }
      setPlay((current) => current + 1);
    }, []),
  );

  return (
    <Screen title={__('nav.chart')}>
      {!ready ? (
        <SkeletonList />
      ) : (
        <View style={styles.container}>
          <SegmentBar
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'categories', label: __('category.categories') },
              { value: 'payments', label: __('category.payments') },
              { value: 'accounts', label: __('category.accounts') },
            ]}
          />
          {segment === 'categories' && <CategoriesSection play={play} />}
          {segment === 'payments' && <NamedSection kind="payment" play={play} />}
          {segment === 'accounts' && <NamedSection kind="account" play={play} />}
        </View>
      )}
    </Screen>
  );
}

function flatten(groups: Group[], kind: GroupKind) {
  const list = groups.filter((group) => group.kind === kind);
  const rows: { group: Group; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    list
      .filter((group) => (group.parentId ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((group) => {
        rows.push({ group, depth });
        walk(group.id, depth + 1);
      });
  };
  walk(null, 0);
  return rows;
}

function CategoriesSection({ play }: { play: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { __ } = useI18n();
  const { groups, createGroup, updateGroup, deleteGroup } = useData();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const rows = useMemo(
    () => [...flatten(groups, 'expense'), ...flatten(groups, 'income')],
    [groups]
  );

  return (
    <>
      <AddButton label={__('common.add')} onPress={() => { setEditing(null); setOpen(true); }} />
      <FlatList
        style={styles.fill}
        data={rows}
        keyExtractor={(item) => item.group.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + BottomMenuClearance }]}
        ListEmptyComponent={<ThemedText themeColor="textSecondary" style={styles.empty}>{__('category.empty')}</ThemedText>}
        renderItem={({ item, index }) => (
          <RevealItem index={index} play={play}>
          <SwipeRow onDelete={() => deleteGroup(item.group.id).catch(console.error)}>
            <Pressable
              onPress={() => { setEditing(item.group); setOpen(true); }}
              style={[styles.row, { backgroundColor: theme.backgroundElement, marginLeft: item.depth * Spacing.three }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="smallBold">{item.group.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.group.kind === 'income' ? __('kind.income') : __('kind.expense')}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          </SwipeRow>
          </RevealItem>
        )}
      />
      <GroupFormModal
        visible={open}
        title={editing ? __('category.edit') : __('category.new')}
        initial={editing}
        groups={groups}
        onClose={() => setOpen(false)}
        onSave={async (name, kind, parentId) => {
          if (editing) await updateGroup(editing.id, name, kind, parentId);
          else await createGroup(name, kind, parentId);
        }}
      />
    </>
  );
}

function NamedSection({ kind, play }: { kind: 'payment' | 'account'; play: number }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { __ } = useI18n();
  const data = useData();
  const rows: (PaymentMethod | BankAccount)[] = kind === 'payment' ? data.paymentMethods : data.bankAccounts;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | BankAccount | null>(null);
  const isPayment = kind === 'payment';

  return (
    <>
      <AddButton label={__('common.add')} onPress={() => { setEditing(null); setOpen(true); }} />
      <FlatList
        style={styles.fill}
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + BottomMenuClearance }]}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {isPayment ? __('payment.empty') : __('account.empty')}
          </ThemedText>
        }
        renderItem={({ item, index }) => (
          <RevealItem index={index} play={play}>
          <SwipeRow
            onDelete={() =>
              (isPayment ? data.deletePaymentMethod(item.id) : data.deleteBankAccount(item.id)).catch(console.error)
            }>
            <Pressable
              onPress={() => { setEditing(item); setOpen(true); }}
              style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText>{item.name}</ThemedText>
            </Pressable>
          </SwipeRow>
          </RevealItem>
        )}
      />
      <NameModal
        visible={open}
        title={
          editing
            ? isPayment ? __('payment.edit') : __('account.edit')
            : isPayment ? __('payment.new') : __('account.new')
        }
        placeholder={isPayment ? __('payment.name_ph') : __('account.name_ph')}
        initial={editing?.name ?? ''}
        onClose={() => setOpen(false)}
        onSave={async (name) => {
          if (isPayment) {
            if (editing) await data.updatePaymentMethod(editing.id, name);
            else await data.createPaymentMethod(name);
          } else if (editing) {
            await data.updateBankAccount(editing.id, name);
          } else {
            await data.createBankAccount(name);
          }
        }}
      />
    </>
  );
}

function SegmentBar<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  const theme = useTheme();
  return (
    <View style={styles.segmentsWrap}>
      <View style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.segment, selected && { backgroundColor: theme.background }]}>
              <ThemedText
                type={selected ? 'smallBold' : 'small'}
                themeColor={selected ? 'text' : 'textSecondary'}
                style={styles.segmentLabel}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.add, { backgroundColor: theme.accent }]}>
      <ThemedText style={styles.addLabel}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fill: { flex: 1 },
  segmentsWrap: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  segment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  segmentLabel: { lineHeight: 18, textAlign: 'center' },
  add: { alignSelf: 'flex-end', marginRight: Spacing.four, marginBottom: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  addLabel: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: Spacing.four, gap: Spacing.two, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.six },
});

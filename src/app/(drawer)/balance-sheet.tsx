import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetFormModal } from '@/components/asset-form-modal';
import { DragSource } from '@/components/drag-source';
import { Screen } from '@/components/screen';
import { SectionAccordion } from '@/components/section-accordion';
import { SkeletonList } from '@/components/skeleton';
import { SwipeRow } from '@/components/swipe-row';
import { ThemedText } from '@/components/themed-text';
import { BottomMenuClearance, MaxContentWidth, Spacing } from '@/constants/theme';
import { useData } from '@/data/DataProvider';
import type { Asset, AssetClassification, AssetWithBalance } from '@/data/types';
import { valueAsOf } from '@/domain/balance';
import { formatDateInput, todayIso } from '@/domain/format';
import { addMonths, currentYearMonth, formatBrl, yearMonthLabel } from '@/domain/recurrence';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

type Frame = { x: number; y: number; width: number; height: number };

type DragState = {
  id: string;
  classification: AssetClassification;
  name: string;
  balance: number;
  x: number;
  y: number;
};

export default function BalanceSheetScreen() {
  const { __ } = useI18n();
  const { ready, assets, createAsset, updateAsset, deleteAsset, moveAssetClassification, listAssetChildren, createAssetAporte } = useData();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [detail, setDetail] = useState<AssetWithBalance | null>(null);
  const [children, setChildren] = useState<Asset[]>([]);
  const [aporteOpen, setAporteOpen] = useState(false);
  const [createClass, setCreateClass] = useState<AssetClassification | null>(null);
  const [expanded, setExpanded] = useState<Record<AssetClassification, boolean>>({
    short_term: false,
    long_term: false,
    good: false,
    liability: false,
  });
  const [viewportBottom, setViewportBottom] = useState(0);
  const [origins, setOrigins] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hover, setHover] = useState<AssetClassification | null>(null);
  const dragId = useRef<string | null>(null);
  const suppressPress = useRef(false);
  const frames = useRef<Partial<Record<AssetClassification, Frame>>>({});
  const targetRefs = useRef<Partial<Record<AssetClassification, View | null>>>({});
  const hostRef = useRef<View>(null);
  const hostOrigin = useRef({ x: 0, y: 0 });

  const transferable: AssetClassification[] = ['short_term', 'long_term', 'good'];

  function rememberHost() {
    hostRef.current?.measureInWindow((x, y) => {
      hostOrigin.current = { x, y };
    });
  }

  function rememberTarget(key: AssetClassification) {
    targetRefs.current[key]?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      frames.current[key] = { x, y, width, height };
    });
  }

  function rememberTargets() {
    rememberHost();
    transferable.forEach(rememberTarget);
  }

  function hitTest(x: number, y: number): AssetClassification | null {
    for (const key of transferable) {
      const frame = frames.current[key];
      if (!frame) continue;
      const inside = x >= frame.x && x <= frame.x + frame.width && y >= frame.y && y <= frame.y + frame.height;
      if (inside) return key;
    }
    return null;
  }

  const label: Record<AssetClassification, string> = {
    short_term: __('balance.short_term'),
    long_term: __('balance.long_term'),
    good: __('balance.good'),
    liability: __('balance.liability'),
  };

  const freshDetail = detail ? assets.find((asset) => asset.id === detail.id) ?? detail : null;

  function beginDrag(asset: AssetWithBalance, x: number, y: number) {
    suppressPress.current = true;
    dragId.current = asset.id;
    rememberTargets();
    setHover(null);
    setDrag({ id: asset.id, classification: asset.classification, name: asset.name, balance: asset.balance, x, y });
  }

  function moveDrag(asset: AssetWithBalance, x: number, y: number) {
    if (dragId.current !== asset.id) return;
    const target = hitTest(x, y);
    setHover(target && target !== asset.classification ? target : null);
    setDrag((current) => (current && current.id === asset.id ? { ...current, x, y } : current));
  }

  function endDrag(asset: AssetWithBalance, x: number, y: number) {
    if (dragId.current !== asset.id) return;
    dragId.current = null;
    const target = hitTest(x, y);
    setDrag(null);
    setHover(null);
    if (target && target !== asset.classification) {
      moveAssetClassification(asset.id, target).catch(console.error);
    }
    setTimeout(() => {
      suppressPress.current = false;
    }, 80);
  }

  function cancelDrag(assetId: string) {
    if (dragId.current !== assetId) return;
    dragId.current = null;
    setDrag(null);
    setHover(null);
    setTimeout(() => {
      suppressPress.current = false;
    }, 80);
  }

  async function openDetail(asset: AssetWithBalance) {
    setDetail(asset);
    setChildren(await listAssetChildren(asset.id));
  }

  if (!ready) {
    return (
      <Screen title={__('nav.balance')}>
        <SkeletonList />
      </Screen>
    );
  }

  return (
    <Screen title={__('nav.balance')}>
      {freshDetail ? (
        <Detail
          asset={freshDetail}
          children={children}
          onBack={() => setDetail(null)}
          onEdit={() => { setEditing(freshDetail); setOpen(true); }}
          onAporte={() => setAporteOpen(true)}
          onEditChild={(child) => { setEditing(child); setOpen(true); }}
          onDeleteChild={async (child) => {
            await deleteAsset(child.id);
            setChildren(await listAssetChildren(freshDetail.id));
          }}
        />
      ) : (
        <View ref={hostRef} style={styles.host} onLayout={rememberHost}>
        <ScrollView
          scrollEnabled={!drag}
          scrollEventThrottle={16}
          onLayout={(event) => {
            setViewportBottom(event.nativeEvent.layout.height);
            rememberTargets();
          }}
          onScroll={(event) => {
            const { layoutMeasurement, contentOffset } = event.nativeEvent;
            setViewportBottom(contentOffset.y + layoutMeasurement.height);
            rememberTargets();
          }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomMenuClearance }]}>
          {([
            {
              title: __('balance.you_have'),
              hint: __('balance.drag_hint'),
              keys: ['short_term', 'long_term', 'good'] as AssetClassification[],
            },
            { title: __('balance.you_owe'), hint: '', keys: ['liability'] as AssetClassification[] },
          ]).map((group) => (
            <View
              key={group.title}
              style={styles.block}
              onLayout={(event) => {
                const y = event.nativeEvent.layout.y;
                setOrigins((current) => (current[group.title] === y ? current : { ...current, [group.title]: y }));
              }}>
              <ThemedText type="smallBold">{group.title}</ThemedText>
              {group.hint ? (
                <ThemedText type="small" themeColor="textSecondary">{group.hint}</ThemedText>
              ) : null}
              {group.keys.map((classification) => {
                const rows = assets.filter((asset) => asset.classification === classification);
                const total = rows.reduce((sum, asset) => sum + asset.balance, 0);
                const canDrop = transferable.includes(classification);
                return (
                  <View
                    key={classification}
                    ref={(node) => {
                      targetRefs.current[classification] = node;
                    }}
                    onLayout={() => {
                      if (canDrop) rememberTarget(classification);
                    }}
                    style={
                      canDrop
                        ? [styles.dropTarget, { borderColor: hover === classification ? theme.accent : 'transparent' }]
                        : undefined
                    }>
                  <SectionAccordion
                    title={label[classification]}
                    total={formatBrl(total)}
                    items={rows}
                    filterItem={(asset, query) => asset.name.toLowerCase().includes(query)}
                    keyExtractor={(asset) => asset.id}
                    expanded={expanded[classification]}
                    onToggle={() => setExpanded((current) => ({ ...current, [classification]: !current[classification] }))}
                    viewportBottom={viewportBottom}
                    origin={origins[group.title] ?? 0}
                    addLabel={__('balance.new')}
                    emptyLabel={__('balance.empty')}
                    onAdd={() => { setEditing(null); setCreateClass(classification); setOpen(true); }}
                    renderItem={(asset) => (
                      <SwipeRow onDelete={() => deleteAsset(asset.id)}>
                        <DragSource
                          enabled={canDrop}
                          onStart={(x, y) => beginDrag(asset, x, y)}
                          onMove={(x, y) => moveDrag(asset, x, y)}
                          onEnd={(x, y) => endDrag(asset, x, y)}
                          onCancel={() => cancelDrag(asset.id)}>
                        <Pressable
                          onPress={() => {
                            if (suppressPress.current) {
                              suppressPress.current = false;
                              return;
                            }
                            openDetail(asset).catch(console.error);
                          }}
                          style={[
                            styles.row,
                            { backgroundColor: theme.background, opacity: drag?.id === asset.id ? 0.35 : 1 },
                          ]}>
                          <View style={{ flex: 1 }}>
                            <ThemedText type="smallBold">{asset.name}</ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {asset.classification === 'liability'
                                ? asset.countsAsDebt ? __('balance.contracted') : __('balance.you_owe')
                                : asset.childrenCount === 1
                                  ? __('balance.aportes_count_one')
                                  : asset.childrenCount > 1
                                    ? __('balance.aportes_count', { count: asset.childrenCount })
                                    : formatDateInput(asset.date)}
                            </ThemedText>
                          </View>
                          <ThemedText style={{ color: asset.balance >= 0 ? theme.income : theme.expense }}>
                            {formatBrl(asset.balance)}
                          </ThemedText>
                        </Pressable>
                        </DragSource>
                      </SwipeRow>
                    )}
                  />
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
        {drag && (
          <View
            pointerEvents="none"
            style={[
              styles.ghost,
              {
                backgroundColor: theme.backgroundElement,
                left: drag.x - hostOrigin.current.x - 110,
                top: drag.y - hostOrigin.current.y - 28,
              },
            ]}>
            <ThemedText type="smallBold">{drag.name}</ThemedText>
            <ThemedText type="small" style={{ color: drag.balance >= 0 ? theme.income : theme.expense }}>
              {formatBrl(drag.balance)}
            </ThemedText>
          </View>
        )}
        </View>
      )}

      <AssetFormModal
        visible={open}
        title={editing?.parentId ? __('balance.edit_aporte') : editing ? __('balance.edit') : __('balance.new')}
        initial={editing}
        aporte={!!editing?.parentId}
        defaultDate={todayIso()}
        defaultClassification={editing ? undefined : createClass ?? undefined}
        onClose={() => { setOpen(false); setEditing(null); setCreateClass(null); }}
        onSave={async (input) => {
          if (editing) {
            await updateAsset(editing.id, input);
            if (freshDetail) setChildren(await listAssetChildren(freshDetail.id));
          } else {
            await createAsset(input);
          }
        }}
      />
      <AssetFormModal
        visible={aporteOpen}
        aporte
        title={__('balance.aporte')}
        defaultDate={todayIso()}
        onClose={() => setAporteOpen(false)}
        onSave={async (input) => {
          if (!freshDetail) return;
          await createAssetAporte(freshDetail.id, input);
          setChildren(await listAssetChildren(freshDetail.id));
        }}
      />
    </Screen>
  );
}

function Detail({
  asset,
  children,
  onBack,
  onEdit,
  onAporte,
  onEditChild,
  onDeleteChild,
}: {
  asset: AssetWithBalance;
  children: Asset[];
  onBack: () => void;
  onEdit: () => void;
  onAporte: () => void;
  onEditChild: (asset: Asset) => void;
  onDeleteChild: (asset: Asset) => void;
}) {
  const theme = useTheme();
  const { __ } = useI18n();
  const [month, setMonth] = useState(currentYearMonth());
  const visible = useMemo(() => children.filter((child) => child.yearMonth === month), [children, month]);
  const balance = valueAsOf(asset, children, month);
  const isDebt = asset.classification === 'liability';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.back}>
        <Ionicons name="chevron-back" size={20} color={theme.text} />
        <ThemedText type="smallBold">{asset.name}</ThemedText>
      </Pressable>
      <ThemedText type="smallBold" style={{ color: asset.balance >= 0 ? theme.income : theme.expense }}>
        {__('balance.current', { value: formatBrl(asset.balance) })}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {__('balance.initial', { value: formatBrl(asset.amount), date: formatDateInput(asset.date) })}
      </ThemedText>
      <View style={styles.actions}>
        <Pressable onPress={onEdit} style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="create-outline" size={18} color={theme.text} />
        </Pressable>
        {!isDebt && (
          <Pressable onPress={onAporte} style={[styles.add, { backgroundColor: theme.accent }]}>
            <ThemedText style={styles.addLabel}>{__('balance.aporte')}</ThemedText>
          </Pressable>
        )}
      </View>
      {!isDebt && (
        <>
          <View style={styles.monthNav}>
            <Pressable onPress={() => setMonth((current) => addMonths(current, -1))}><Ionicons name="chevron-back" size={18} color={theme.text} /></Pressable>
            <ThemedText type="smallBold">{yearMonthLabel(month)}</ThemedText>
            <Pressable onPress={() => setMonth((current) => addMonths(current, 1))}><Ionicons name="chevron-forward" size={18} color={theme.text} /></Pressable>
          </View>
          <ThemedText type="smallBold" style={{ color: balance >= 0 ? theme.income : theme.expense }}>
            {__('balance.as_of', { month: yearMonthLabel(month), value: formatBrl(balance) })}
          </ThemedText>
          <ThemedText type="smallBold">{__('balance.aportes_in', { month: yearMonthLabel(month) })}</ThemedText>
          {visible.length === 0 && <ThemedText themeColor="textSecondary">{__('balance.no_aportes', { month: yearMonthLabel(month) })}</ThemedText>}
          {visible.map((child) => (
            <SwipeRow key={child.id} onDelete={() => onDeleteChild(child)}>
              <Pressable onPress={() => onEditChild(child)} style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{child.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{formatDateInput(child.date)}</ThemedText>
                </View>
                <ThemedText>{formatBrl(child.amount)}</ThemedText>
              </Pressable>
            </SwipeRow>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  dropTarget: { borderWidth: 2, borderRadius: Spacing.three },
  ghost: {
    position: 'absolute',
    width: 220,
    zIndex: 30,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  block: { gap: Spacing.two, marginTop: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  add: { alignSelf: 'flex-end', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.three },
  addLabel: { color: '#fff', fontWeight: '700' },
  back: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBtn: { width: 36, height: 36, borderRadius: Spacing.two, alignItems: 'center', justifyContent: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

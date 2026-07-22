import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Mês</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar' }}
          md="calendar_month"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Label>Saídas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'arrow.up.circle', selected: 'arrow.up.circle.fill' }}
          md="arrow_upward"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="incomes">
        <NativeTabs.Trigger.Label>Entradas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'arrow.down.circle', selected: 'arrow.down.circle.fill' }}
          md="arrow_downward"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="charts">
        <NativeTabs.Trigger.Label>Evolução</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          md="bar_chart"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

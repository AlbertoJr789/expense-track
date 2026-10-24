import { Drawer } from 'expo-router/drawer';

import { AppDrawer } from '@/components/app-drawer';

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <AppDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        swipeEdgeWidth: 72,
        swipeMinDistance: 8,
        overlayColor: 'rgba(0,0,0,0.28)',
        drawerStyle: { width: 312 },
      }}>
      <Drawer.Screen name="index" />
      <Drawer.Screen name="chart-of-accounts" />
      <Drawer.Screen name="incomes" />
      <Drawer.Screen name="expenses" />
      <Drawer.Screen name="balance-sheet" />
      <Drawer.Screen name="goals" />
      <Drawer.Screen name="timeline" />
      <Drawer.Screen name="radiography" />
      <Drawer.Screen name="lifestyle" />
    </Drawer>
  );
}

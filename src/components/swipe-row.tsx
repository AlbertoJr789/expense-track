import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  children: ReactNode;
  onDelete: () => void;
};

const ACTION_WIDTH = 96;

export function SwipeRow({ children, onDelete }: Props) {
  const theme = useTheme();

  const renderAction = (align: 'flex-start' | 'flex-end') => () => (
    <View style={[styles.action, { backgroundColor: theme.expense, justifyContent: align }]}>
      <Ionicons name="trash-outline" size={22} color="#fff" />
    </View>
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      leftThreshold={ACTION_WIDTH * 0.6}
      rightThreshold={ACTION_WIDTH * 0.6}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderAction('flex-start')}
      renderRightActions={renderAction('flex-end')}
      onSwipeableOpen={() => onDelete()}
      containerStyle={styles.container}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
  },
  action: {
    flex: 1,
    width: ACTION_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});

import { Screen } from '@/components/screen';
import { CashflowScreen } from '@/components/cashflow-screen';
import { useI18n } from '@/i18n';

export default function ExpensesRoute() {
  const { __ } = useI18n();
  return (
    <Screen title={__('nav.expenses')}>
      <CashflowScreen kind="expense" />
    </Screen>
  );
}

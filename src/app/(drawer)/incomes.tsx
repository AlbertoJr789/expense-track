import { CashflowScreen } from '@/components/cashflow-screen';
import { Screen } from '@/components/screen';
import { useI18n } from '@/i18n';

export default function IncomesRoute() {
  const { __ } = useI18n();
  return (
    <Screen title={__('nav.incomes')}>
      <CashflowScreen kind="income" />
    </Screen>
  );
}

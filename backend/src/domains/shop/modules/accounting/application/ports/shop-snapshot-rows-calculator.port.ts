import { Period } from '@/shared/domain/period.value-object';
import type { ShopAccountingPeriodSnapshotRow } from './shop-accounting-period-snapshot.port';

// Зеркало domains/service/modules/accounting/application/ports/
// snapshot-rows-calculator.port.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимый порт для
// направления shop. Расчёт строк снапшота закрытия (FACT-срез по каждому
// сотруднику с зарплатными правилами) — единственный вход и для самого
// закрытия (CloseShopAccountingPeriodHandler), и для сводки окна
// подтверждения (GetShopClosePeriodPreviewService), реализация —
// CalculateShopSnapshotRowsService.
export interface ShopSnapshotRowsCalculatorPort {
    calculate(period: Period): Promise<ShopAccountingPeriodSnapshotRow[]>;
}

export const SHOP_SNAPSHOT_ROWS_CALCULATOR = Symbol(
    'SHOP_SNAPSHOT_ROWS_CALCULATOR',
);

import { Period } from '@/shared/domain/period.value-object';
import type { AccountingPeriodSnapshotRow } from './accounting-period-snapshot.port';

// Расчёт строк снапшота закрытия (FACT-срез по каждому сотруднику с
// зарплатными правилами направления) — единственный вход и для самого
// закрытия (Close*AccountingPeriodHandler), и для сводки окна подтверждения
// (GetClosePeriodPreviewService): PRD 1 требует, чтобы значения preview
// совпадали с результатом реального закрытия, поэтому считать их должен
// один и тот же код. Реализация своя у каждого направления
// (CalculateServiceSnapshotRowsService / CalculateShopSnapshotRowsService),
// провайдится под этим токеном в своём модуле.
export interface SnapshotRowsCalculatorPort {
    calculate(period: Period): Promise<AccountingPeriodSnapshotRow[]>;
}

export const SNAPSHOT_ROWS_CALCULATOR = Symbol('SNAPSHOT_ROWS_CALCULATOR');

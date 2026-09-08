import type {
    SalaryCalculationMode,
    SalesPerformanceContext,
} from '@/shared/domain/calculation-context';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

// Режим расчёта FACT | PROGNOSE в контексте (Фаза 9, см.
// docs/payroll/prd-payroll-calculation.md, раздел 6): в режиме PROGNOSE
// правило получает SalesPrognose.percentCompletion вместо
// SalesFact.percentCompletion на вход вместо фактического процента
// выполнения плана — единственное отличие между двумя проходами
// calculate(), больше ничего в контексте не меняется. Личная база
// сотрудника (erpData) в обоих режимах общая — она передаётся вызывающей
// стороной без изменений, эта функция трогает только процент выполнения
// плана подразделения.
export function toSalesPerformanceContext(
    performance: SalesPerformance | null,
    mode: SalaryCalculationMode,
): SalesPerformanceContext | null {
    if (!performance) {
        return null;
    }
    const percentCompletion =
        mode === 'PROGNOSE'
            ? performance.getPrognose().getPercentCompletion()
            : performance.getFact().getPercentCompletion();

    return {
        department: performance.getDepartment(),
        category: performance.getCategory(),
        percentCompletion,
    };
}

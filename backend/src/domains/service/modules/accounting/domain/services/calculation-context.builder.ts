import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Общий базовый контекст (без mode — FACT/PROGNOSE выбирает вызывающая
// сторона) — используется и открытым расчётом отчёта
// (GetEmployeeSalaryReportService), и закрытием периода
// (CloseAccountingPeriodHandler, снимающим FACT-срез на снапшот), чтобы обе
// точки не расходились в сборке контекста (см. PRD: "Контекст собирается
// один раз ... одинаковую выборку данных для всех правил").
//
// erpData/salesPerformance пока не подкладываются (Фазы 2, 5, 7-13) — как и
// в Фазе 1, доступные на сегодня правила их не используют.
export function buildBaseCalculationContext(
    direction: AccountingDirection,
    period: Period,
    employeeId: number,
): Omit<CalculationContext, 'mode'> {
    const { from, to } = period.getBounds();
    return {
        employee: { id: employeeId, identities: [] },
        period: {
            direction,
            period: period.getValue(),
            from,
            to,
            status: 'OPEN',
        },
        erpData: undefined,
        salesPerformance: null,
    };
}

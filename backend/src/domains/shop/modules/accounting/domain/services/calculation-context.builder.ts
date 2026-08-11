import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Зеркало domains/service/modules/accounting/domain/services/calculation-context.builder.ts
// (Фаза 13.5, issue #57) — независимая реализация в домене shop. Общий
// базовый контекст (без mode — FACT/PROGNOSE выбирает вызывающая сторона),
// используется и открытым расчётом отчёта, и закрытием периода, чтобы обе
// точки не расходились в сборке контекста (см. PRD: "Контекст собирается
// один раз ... одинаковую выборку данных для всех правил").
//
// erpData/employee.identities реально заполняются приложением поверх этого
// скелета — см. будущий BuildShopCalculationContextService (по образцу
// BuildServiceCalculationContextService сервиса, см. domains/shop/CLAUDE.md
// — не реализован ни в одной из завершённых фаз). salesPerformance
// по-прежнему не подкладывается здесь — доступные на сегодня правила его не
// используют напрямую из этого скелета.
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

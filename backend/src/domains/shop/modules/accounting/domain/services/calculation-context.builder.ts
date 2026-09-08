import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';

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
export class CalculationContextBuilder implements Omit<
    ShopCalculationContext,
    'mode'
> {
    readonly employee: ShopCalculationContext['employee'];
    readonly period: ShopCalculationContext['period'];
    readonly erpData: ShopCalculationContext['erpData'];
    readonly salesPerformance: ShopCalculationContext['salesPerformance'];

    constructor(
        direction: AccountingDirection,
        period: Period,
        employeeId: number,
    ) {
        const { from, to } = period.getBounds();
        this.employee = { id: employeeId, identities: [] };
        this.period = {
            direction,
            period: period.getValue(),
            from,
            to,
            status: 'OPEN',
        };
        this.erpData = undefined;
        this.salesPerformance = null;
    }
}

import { ConflictException } from '@/shared/exceptions';

// Зеркало domains/service/modules/accounting/domain/exceptions/float-percent.exception.ts
// (Фаза 12, независимая реализация — issue #57). FloatPercent (ProductSold)
// не может посчитать множитель без ShopSalesPerformance отдела сотрудника
// за период — возникает, когда для CalculationContext.salesPerformance не
// нашлось строки плана магазина.
export class ShopSalesPerformanceRequiredException extends ConflictException {
    constructor(period: string) {
        super(
            `Для расчёта правила с плавающим процентом (FloatPercent) за период ${period} ` +
                'отсутствует план продаж магазина по подразделению сотрудника — расчёт невозможен',
        );
    }
}

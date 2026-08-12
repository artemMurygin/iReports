import { SalesPerformance } from '../../domain/value-objects/sales-performance.value-object';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

// Единственный вход в SalesPerformance для остальных модулей (Фаза 5,
// "дублирующего расчёта плана внутри зарплатного модуля нет" — см.
// docs/payroll/plan-payroll-calculation.md). Интерфейс отдельно от
// GetSalesPerformanceService, чтобы accounting (Фаза 9) зависел от
// абстракции модуля sales через DI-токен, а не от конкретного
// application-сервиса — тот же приём, что и с SALES_PLAN_REPOSITORY,
// экспортированным из SalesModule заранее.
export interface SalesPerformanceReaderPort {
    // Все строки SalesPerformance периода — вход эндпоинта
    // GET /service/sales/salesPerformance/:period.
    listForPeriod(
        direction: SalesDirection,
        period: string,
    ): Promise<SalesPerformance[]>;

    // Одна строка по отделу и, опционально, категории — вход
    // CalculationContext.salesPerformance зарплатного расчёта (Фаза 9).
    // null, если для этой комбинации нет строки плана.
    findForScope(
        direction: SalesDirection,
        period: string,
        department: number,
        category: number | null,
    ): Promise<SalesPerformance | null>;
}

export const SALES_PERFORMANCE_READER = Symbol('SALES_PERFORMANCE_READER');

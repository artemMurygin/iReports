import type { SalesPerformanceSummary } from 'ireports-contracts';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/shop-sales-performance.value-object';

// Зеркало domains/service/modules/accounting/application/mappers/to-sales-performance-summary.ts
// (Фаза 13.5, issue #57) — независимая реализация для направления shop.
// Компактный срез ShopSalesPerformance для ответа зарплатного отчёта: план,
// факт, процент выполнения, прогноз по отделу сотрудника — без отдельного
// запроса с фронтенда. Строится из того же ShopSalesPerformance, который
// уже был получен для расчёта FloatPercent
// (BuildShopCalculationContextService.findSalesPerformance) — дублирующего
// похода в модуль sales здесь нет.
export function toShopSalesPerformanceSummary(
    performance: ShopSalesPerformance | null,
): SalesPerformanceSummary | null {
    if (!performance) {
        return null;
    }
    const plan = performance.getPlan();
    const fact = performance.getFact();
    const prognose = performance.getPrognose();

    return {
        department: performance.getDepartment(),
        category: performance.getCategory(),
        plan: { turnover: plan.turnover, margin: plan.margin },
        fact: { turnover: fact.getTurnover(), margin: fact.getMargin() },
        prognose: {
            turnover: prognose.getTurnover(),
            margin: prognose.getMargin(),
        },
        // "Текущий" процент выполнения плана — фактический, а не прогнозный
        // (прогнозный уже отдельно виден через prognose.turnover/plan.turnover
        // на UI при необходимости).
        percentCompletion: fact.getPercentCompletion(),
    };
}

// Ответ отчёта отдаёт `salesPerformance[]` — по одной строке на каждую
// строку плана отдела за период (см. GetShopEmployeeSalaryReportService) —
// план считается не утверждённым, если хотя бы одна из этих строк ещё в
// статусе CREATED (та же логика "предварительные цифры", что и у отчёта
// направления service, но по всему списку сразу, а не по одной сводке).
// Нет ни одной строки плана вовсе — признак не блокирует ничего, остаётся
// true.
export function isShopSalesPerformancePlanApprovedList(
    performances: ShopSalesPerformance[],
): boolean {
    if (performances.length === 0) {
        return true;
    }
    return performances.every(
        (performance) => performance.getPlan().status === 'APPROVED',
    );
}

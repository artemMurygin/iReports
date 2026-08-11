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

// Пока в периоде есть строки SalesPlan в статусе CREATED, план считается не
// утверждённым — отчёт помечается признаком "план не утверждён, цифры
// предварительные". Нет строки плана вовсе (для отдела ещё не создан ни
// план, ни факт) — признак не блокирует ничего, остаётся true.
export function isShopSalesPerformancePlanApproved(
    performance: ShopSalesPerformance | null,
): boolean {
    if (!performance) {
        return true;
    }
    return performance.getPlan().status === 'APPROVED';
}

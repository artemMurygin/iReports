import type { SalesPerformanceSummary } from 'ireports-contracts';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

// Компактный срез SalesPerformance для ответа зарплатного отчёта (Фаза 9,
// см. docs/payroll/prd-payroll-calculation.md, раздел 6 и "Контракты"):
// план, факт, процент выполнения, прогноз по отделу сотрудника — без
// отдельного запроса с фронтенда. Строится из того же SalesPerformance,
// который уже был получен для расчёта FloatPercent
// (BuildServiceCalculationContextService.findSalesPerformance) —
// дублирующего похода в модуль sales здесь нет (см. PRD: "дублирующего
// расчёта плана внутри зарплатного модуля нет, данные читаются из модуля
// sales через порт").
export function toSalesPerformanceSummary(
    performance: SalesPerformance | null,
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
// предварительные" (Фаза 9, см. PRD раздел 6). Нет строки плана вовсе (для
// отдела ещё не создан ни план, ни факт) — признак не блокирует ничего,
// остаётся true (как и раньше, до Фазы 9).
export function isSalesPerformancePlanApproved(
    performance: SalesPerformance | null,
): boolean {
    if (!performance) {
        return true;
    }
    return performance.getPlan().status === 'APPROVED';
}

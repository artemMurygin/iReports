import type { CalculationContext } from '@/shared/domain/calculation-context';

// Implements FR2-FR4 of add-department-head-salary-rules.
//
// Расширение общего CalculationContext (shared/domain/calculation-context.ts) для 3 новых видов
// правила уровня отдела/направления (design.md Decision 3, architecture.md "ServiceCalculationContext")
// — по образцу уже существующего ShopCalculationContext
// (domains/shop/modules/accounting/domain/types/calculation-context.types.ts), но ТОЛЬКО
// ДОБАВЛЯЕТ новые поля поверх CalculationContext, а не переопределяет существующее
// context.salesPerformance: те 4 существующих вида правила (PayPerHour/ServiceCompleted/OrderPayed/
// TaskCompletion) продолжают читать context.salesPerformance (общий тип) без изменений — их
// сборку/потребление трогает отдельная задача (BuildServiceCalculationContextService,
// registry/factory — tasks.md раздел 12). departmentSalesPerformance/turnoverPerformance ниже — вход
// ТОЛЬКО для DepartmentPercentEntity/DepartmentPlanBonusEntity/DepartmentTurnoverBonusEntity,
// собираются тем же application-сервисом одновременно с остальным контекстом.

// Факт SalesPerformance за период — DepartmentPercentEntity (FR2) нужен именно факт (turnover/
// margin), а не только готовый percentCompletion, который используют DepartmentPlanBonusEntity (FR3)
// и уже существующие 4 вида правил.
export interface DepartmentSalesPerformanceEntry {
    fact: { turnover: number; margin: number };
    percentCompletion: number;
}

// Карта factory/percentCompletion по category правила уровня отдела (FR2/FR3) — по аналогии с уже
// существующей ShopSalesPerformanceByCategory: одна мотивационная схема может нести несколько
// DepartmentPercent/DepartmentPlanBonus правил с РАЗНЫМИ category, каждому нужен факт именно своей
// категории. Ключ null — «весь отдел/направление» (config.category === null). Категория, для которой
// SalesPerformance не резолвится (нет плана/факта за период), в карте отсутствует — правило само
// решает, что делать при отсутствующем ключе (design.md Q2 — начисляет 0, а не бросает ошибку, в
// отличие от FloatPercent существующих видов правил).
export type DepartmentSalesPerformanceByCategory = Map<
    string | null,
    DepartmentSalesPerformanceEntry
>;

// Временный костыль поверх design.md Decision 1 (см. WHY у DepartmentPercentSalaryConfig.departmentId/
// DepartmentPlanBonusSalaryConfig.departmentId в salary-rule.types.ts): скоуп факта/percentCompletion
// для правила, ЯВНО переопределившего отдел, чей план продаж используется, вместо собственного отдела
// сотрудника. Отдельная от DepartmentSalesPerformanceByCategory карта (а не тот же ключ) — та карта
// всегда про СОБСТВЕННЫЙ отдел сотрудника и не знает о departmentId, здесь наоборот departmentId
// обязателен, ключ — departmentPerformanceOverrideScopeKey(). По той же схеме, что и
// TurnoverPerformanceScope/TurnoverPerformanceByScope ниже (там обязателен warehouseId).
export interface DepartmentPerformanceOverrideScope {
    departmentId: number;
    category: string | null;
}

export type DepartmentPerformanceOverrideByScope = Map<
    string,
    DepartmentSalesPerformanceEntry
>;

export function departmentPerformanceOverrideScopeKey(
    scope: DepartmentPerformanceOverrideScope,
): string {
    return `${scope.departmentId}:${scope.category ?? ''}`;
}

// Скоуп факта оборачиваемости для DepartmentTurnoverBonus (FR4) — склад обязателен, категория
// опциональна (design.md Decision 2); null category — итог по всему складу (см.
// GoodsTurnoverWarehouseTotal/TurnoverReportSnapshot, FR5).
export interface TurnoverPerformanceScope {
    warehouseId: number;
    category: string | null;
}

// Факт коэффициента оборачиваемости, пред-резолвленный BuildServiceCalculationContextService через
// TURNOVER_PERFORMANCE_READER для каждого уникального (warehouseId, category) правил
// DepartmentTurnoverBonus схемы сотрудника — по аналогии с тем, как BuildShopCalculationContextService
// уже пред-резолвит salesPerformanceByCategory для ProductSold. Ключ — turnoverPerformanceScopeKey()
// ниже. Значение null — недостаточно данных (см. TurnoverPerformanceReaderPort.findForScope):
// правило начисляет 0 (design.md Q2), а не бросает ошибку.
export type TurnoverPerformanceByScope = Map<string, number | null>;

export function turnoverPerformanceScopeKey(
    scope: TurnoverPerformanceScope,
): string {
    return `${scope.warehouseId}:${scope.category ?? ''}`;
}

export type ServiceCalculationContext = CalculationContext & {
    departmentSalesPerformance: DepartmentSalesPerformanceByCategory | null;
    turnoverPerformance: TurnoverPerformanceByScope;
    departmentPerformanceOverrides: DepartmentPerformanceOverrideByScope;
};

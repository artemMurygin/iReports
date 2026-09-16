import type { CalculationContext } from '@/shared/domain/calculation-context';

// Карта percentCompletion по категории — форма CalculationContext.salesPerformance
// для направления shop (Фаза 2 плана shop-sales-performance-by-category,
// закрывает issue #60). Ключ — ProductSoldSalaryConfig.category /
// UsedProductSoldSalaryConfig.category (id корневой папки
// MoySkladProductFolder — та же категория, что раскрывается до потомков в
// erpData.categoryDescendantFolderIds, см. calculation-data.types.ts);
// null — «весь отдел» (правила без категории: ProductSold/UsedProductSold
// с config.category === null). Одна мотивационная схема
// сотрудника может нести несколько правил ProductSold с РАЗНЫМИ
// категориями — каждому нужен факт именно своей категории, поэтому
// единственное значение SalesPerformanceContext общего CalculationContext
// (department + category + один percentCompletion) здесь не подходит.
// Категории, для которых расчёт не нашёлся (нет плана/факта по scope),
// в карте отсутствуют — правило само решает, что делать при отсутствующем
// ключе (fail closed, см. product-sold.entity.ts), а не читает null/undefined
// как валидный percentCompletion.
export type ShopSalesPerformanceByCategory = Map<string | null, number>;

// Зеркало общего CalculationContext (shared/domain/calculation-context.ts) с
// единственным отличием — salesPerformance несёт карту по категориям, а не
// одно значение на отдел. Общий CalculationContext намеренно НЕ трогаем: им
// продолжает пользоваться domains/service без изменений (см.
// backend/CLAUDE.md, domains/shop/CLAUDE.md — modules/accounting shop
// полностью независим от service по правилам домена, заводить общий
// generic-параметр ради одного направления не нужно). erpData здесь по-
// прежнему unknown, как и в общем типе — конкретные правила сами приводят
// его к ShopCalculationErpData (тот же приём, что уже применён во всех
// сущностях правил shop, см. product-sold.entity.ts).
export type ShopCalculationContext = Omit<
    CalculationContext,
    'salesPerformance'
> & {
    salesPerformance: ShopSalesPerformanceByCategory | null;
};

// Implements FR2-FR4 of add-department-head-salary-rules.
//
// Расширение ShopCalculationContext (выше) для 3 новых видов правила уровня отдела/направления
// (design.md Decision 3, зеркало domains/service/modules/accounting/domain/types/
// calculation-context.types.ts) — ТОЛЬКО ДОБАВЛЯЕТ новые поля, не переопределяет существующее
// salesPerformance: те 4 существующих вида правил магазина (PayPerHour/ProductSold/UsedProductSold/
// TaskCompletion) продолжают читать его без изменений. departmentSalesPerformance/
// turnoverPerformance ниже — вход ТОЛЬКО для DepartmentPercentEntity/DepartmentPlanBonusEntity/
// DepartmentTurnoverBonusEntity магазина.

// Факт ShopSalesPerformance за период — DepartmentPercentEntity (FR2) нужен именно факт (turnover/
// margin), а не только готовый percentCompletion, который используют DepartmentPlanBonusEntity (FR3)
// и существующие 4 вида правил.
export interface DepartmentSalesPerformanceEntry {
    fact: { turnover: number; margin: number };
    percentCompletion: number;
}

// Карта factory/percentCompletion по category правила уровня отдела (FR2/FR3) — по аналогии с уже
// существующей ShopSalesPerformanceByCategory выше: category правила резолвится независимо от
// department-wide ShopSalesPerformanceByCategory, чтобы каждое DepartmentPercent/DepartmentPlanBonus
// правило схемы читало факт именно своей категории. Ключ null — «весь магазин/направление». Категория,
// для которой SalesPerformance не резолвится, в карте отсутствует — правило начисляет 0 (design.md
// Q2), а не бросает ошибку.
export type DepartmentSalesPerformanceByCategory = Map<
    string | null,
    DepartmentSalesPerformanceEntry
>;

// Скоуп факта оборачиваемости для DepartmentTurnoverBonus (FR4) — склад (MoySklad UUID) обязателен,
// категория опциональна (design.md Decision 2); null category — итог по всему складу.
export interface TurnoverPerformanceScope {
    warehouseId: string;
    category: string | null;
}

// Факт коэффициента оборачиваемости, пред-резолвленный BuildShopCalculationContextService через
// SHOP_TURNOVER_PERFORMANCE_READER для каждого уникального (warehouseId, category) правил
// DepartmentTurnoverBonus схемы сотрудника. Ключ — turnoverPerformanceScopeKey() ниже. Значение null
// — недостаточно данных: правило начисляет 0 (design.md Q2), а не бросает ошибку.
export type TurnoverPerformanceByScope = Map<string, number | null>;

export function turnoverPerformanceScopeKey(
    scope: TurnoverPerformanceScope,
): string {
    return `${scope.warehouseId}:${scope.category ?? ''}`;
}

// Временный костыль поверх design.md Decision 1 (зеркало WHY у одноимённых типов в
// domains/service/modules/accounting/domain/types/calculation-context.types.ts) — скоуп факта/
// percentCompletion для правила, ЯВНО переопределившего отдел, чей план продаж используется, вместо
// собственного отдела сотрудника. Отдельная от DepartmentSalesPerformanceByCategory карта — та карта
// всегда про СОБСТВЕННЫЙ отдел сотрудника и не знает о departmentId, здесь наоборот departmentId
// обязателен, ключ — departmentPerformanceOverrideScopeKey(). По той же схеме, что и
// TurnoverPerformanceScope/TurnoverPerformanceByScope выше (там обязателен warehouseId).
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

export type ShopDepartmentCalculationContext = ShopCalculationContext & {
    departmentSalesPerformance: DepartmentSalesPerformanceByCategory | null;
    turnoverPerformance: TurnoverPerformanceByScope;
    departmentPerformanceOverrides: DepartmentPerformanceOverrideByScope;
};

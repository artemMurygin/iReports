import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { CalculationContextBuilder } from '@/domains/shop/modules/accounting/domain/services/calculation-context.builder';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import type {
    DepartmentPercentShopSalaryConfig,
    DepartmentPlanBonusShopSalaryConfig,
    DepartmentTurnoverBonusShopSalaryConfig,
    ShopSalaryRule,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import { buildTaskCompletionStatuses } from '@/domains/shop/modules/accounting/application/services/calculation/task-completion-statuses.builder';
import { SHOP_TURNOVER_PERFORMANCE_READER } from '@/domains/shop/modules/accounting/application/ports/turnover-performance/turnover-performance.port';
import type { ShopTurnoverPerformanceReaderPort } from '@/domains/shop/modules/accounting/application/ports/turnover-performance/turnover-performance.port';
import type {
    DepartmentSalesPerformanceByCategory,
    DepartmentSalesPerformanceEntry,
    TurnoverPerformanceByScope,
    TurnoverPerformanceScope,
} from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import { turnoverPerformanceScopeKey } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';

// Базовый контекст расчёта направления shop, ещё не привязанный к
// конкретному режиму (FACT/PROGNOSE) — зеркало ServiceCalculationBaseContext
// (build-service-calculation-context.service.ts сервиса, Фаза 13.5, issue
// #57). salesPerformanceDetail несёт ПОЛНЫЙ агрегат ShopSalesPerformance
// (план+факт+прогноз), а не урезанный CalculationContext['salesPerformance']
// — по тем же двум причинам, что и у сервиса: один и тот же объект
// превращается в ДВА разных CalculationContext.salesPerformance (через
// to-sales-performance-context.ts) и в компактный блок SalesPerformance
// в ответе отчёта (to-sales-performance-summary.ts) — без второго
// похода в ShopSalesModule.
export interface ShopCalculationBaseContext {
    employee: CalculationContext['employee'];
    period: CalculationContext['period'];
    erpData: ShopCalculationErpData;
    salesPerformanceDetail: ShopSalesPerformance | null;
    // Карта ShopSalesPerformance по категории (Фаза 2 плана
    // shop-sales-performance-by-category) — вход
    // toShopSalesPerformanceContext(), строящей карту
    // CalculationContext.salesPerformance для рассчёта FloatPercent по
    // категории СВОЕГО правила, а не по отделу целиком (см. findSalesPerformance
    // ниже). Ключ null — тот же ShopSalesPerformance, что и
    // salesPerformanceDetail (отдел целиком), под тем же ключом, что читает
    // ProductSold/UsedProductSold с config.category === null.
    salesPerformanceByCategory: Map<string | null, ShopSalesPerformance>;
    // Все строки ShopSalesPerformance отдела сотрудника за период (по
    // каждой заведённой категории) — сырые данные для построчной
    // разбивки "план продаж отдела" по категориям в ответе отчёта (см.
    // findSalesPerformanceByDepartment и GetShopEmployeeSalaryReportService).
    // Не путать с
    // salesPerformanceByCategory — та служит расчёту FloatPercent КАЖДОГО
    // правила по его category, эта — только отображению компактной
    // сводки в самом ответе.
    salesPerformanceByDepartment: ShopSalesPerformance[];
    // Implements FR2-FR3 of add-department-head-salary-rules (tasks.md раздел 13, зеркало service —
    // build-service-calculation-context.service.ts) — факт (turnover/margin) + percentCompletion по
    // СОБСТВЕННОЙ category каждого DepartmentPercent/DepartmentPlanBonus правила переданной схемы, не
    // связано с salesPerformanceByCategory выше (та хранит полный ShopSalesPerformance для
    // ProductSold/UsedProductSold). null, если у сотрудника нет отдела.
    departmentSalesPerformance: DepartmentSalesPerformanceByCategory | null;
    // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 13) — факт. коэффициент
    // оборачиваемости по уникальным (warehouseId, category) скоупам DepartmentTurnoverBonus правил
    // схемы, ключ — turnoverPerformanceScopeKey(). Всегда Map (не null).
    turnoverPerformance: TurnoverPerformanceByScope;
}

// Application-слой сборки контекста расчёта направления shop (Фаза 13.5,
// issue #57) — независимая от BuildServiceCalculationContextService
// реализация (см. backend/CLAUDE.md, "зеркальные, но независимые" модули
// доменов), единственное место, где erpData/employee.identities реально
// заполняются данными из БД для shop.
//
// В отличие от сервисной сигнатуры build(period, employeeId) — здесь есть
// третий параметр rules: categoryDescendantFolderIds зависит от конкретных
// category, указанных в правилах ProductSold/UsedProductSold РАСЧЁТЫВАЕМОЙ
// схемы, а не от всех категорий вообще — раскрывать дерево для категорий,
// которых нет ни в одном правиле схемы, незачем.
@Injectable()
export class BuildShopCalculationContextService {
    constructor(
        @Inject(SHOP_CALCULATION_DATA)
        private readonly dataSource: ShopCalculationDataPort,
        @Inject(SHOP_SALES_PERFORMANCE_READER)
        private readonly salesPerformanceReader: ShopSalesPerformanceReaderPort,
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
        // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 13).
        @Inject(SHOP_TURNOVER_PERFORMANCE_READER)
        private readonly turnoverPerformanceReader: ShopTurnoverPerformanceReaderPort,
    ) {}

    // Раздел 17 tasks.md (add-task-based-salary-rule) — rules: уже
    // разрешённый набор правил сотрудника (личных + отдела, см.
    // ResolveShopEmployeeSalaryRulesService), нужен только чтобы вычленить
    // TaskCompletion-правила и подтянуть их ShopSalaryTask.taskStatus
    // текущего периода (erpData.taskCompletionStatuses, design.md
    // Decision 7). Вызывающий (GetShopEmployeeSalaryReportService) уже
    // резолвит rules ДО построения контекста — не дублируем поход в
    // ShopMotivationSchemaRepository здесь (зеркало build() сервиса,
    // раздел 12).
    async build(
        period: Period,
        employeeId: number,
        rules: ShopSalaryRule[],
    ): Promise<ShopCalculationBaseContext> {
        // 'shop' захардкожен: этот сервис живёт в domains/shop/modules/accounting
        // и не переиспользуется сервисом (см. backend/CLAUDE.md, "зеркальные,
        // но независимые" модули доменов).
        const base = new CalculationContextBuilder('shop', period, employeeId);

        const [
            identities,
            hoursWorked,
            productSoldItems,
            departmentId,
            taskCompletionStatuses,
        ] = await Promise.all([
            this.dataSource.findEmployeeIdentities(employeeId),
            this.dataSource.findHoursWorked(employeeId, period.getValue()),
            this.dataSource.findProductSoldItems(
                base.period.from,
                base.period.to,
            ),
            this.dataSource.findEmployeeDepartmentId(employeeId),
            buildTaskCompletionStatuses(
                this.taskRepo,
                rules,
                period.getValue(),
            ),
        ]);

        const categoryIds = this.collectProductCategoryIds(rules);

        const [
            categoryDescendantFolderIds,
            salesPerformanceDetail,
            salesPerformanceByDepartment,
        ] = await Promise.all([
            this.resolveCategoryDescendantFolderIds(categoryIds),
            this.findSalesPerformance(period, departmentId, null),
            this.findSalesPerformanceByDepartment(period, departmentId),
        ]);

        const [
            salesPerformanceByCategory,
            departmentSalesPerformance,
            turnoverPerformance,
        ] = await Promise.all([
            this.resolveSalesPerformanceByCategory(
                period,
                departmentId,
                categoryIds,
                salesPerformanceDetail,
            ),
            this.resolveDepartmentSalesPerformance(period, departmentId, rules),
            this.resolveTurnoverPerformance(period, rules),
        ]);

        return {
            employee: { ...base.employee, identities },
            period: base.period,
            erpData: {
                hoursWorked,
                productSoldItems,
                categoryDescendantFolderIds,
                taskCompletionStatuses,
            } satisfies ShopCalculationErpData,
            salesPerformanceDetail,
            salesPerformanceByCategory,
            salesPerformanceByDepartment,
            departmentSalesPerformance,
            turnoverPerformance,
        };
    }

    // Уникальные category правил ProductSold/UsedProductSold схемы (issue
    // #60) — только у этих двух типов правил config несёт поле category,
    // PayPerHour его не читает вовсе. Общий
    // список переиспользуется и для раскрытия дерева категорий
    // (resolveCategoryDescendantFolderIds), и для резолва salesPerformance
    // по категории (resolveSalesPerformanceByCategory, Фаза 2 плана
    // shop-sales-performance-by-category) — один проход по правилам вместо
    // двух.
    private collectProductCategoryIds(rules: ShopSalaryRule[]): Set<string> {
        const categoryIds = new Set<string>();
        for (const rule of rules) {
            if (
                rule.type !== 'ProductSold' &&
                rule.type !== 'UsedProductSold'
            ) {
                continue;
            }
            if ('category' in rule.config && rule.config.category != null) {
                categoryIds.add(rule.config.category);
            }
        }
        return categoryIds;
    }

    // Один батч-вызов resolveCategoryDescendantFolderIds на все уникальные
    // корневые папки схемы разом (см. ShopCalculationDataPort), а не по
    // одному на правило.
    private async resolveCategoryDescendantFolderIds(
        categoryIds: Set<string>,
    ): Promise<Record<string, string[]>> {
        if (categoryIds.size === 0) {
            return {};
        }
        return this.dataSource.resolveCategoryDescendantFolderIds([
            ...categoryIds,
        ]);
    }

    // Полный ShopSalesPerformance подразделения сотрудника (category: null)
    // — вход для компактного блока SalesPerformance в ответе отчёта
    // (to-sales-performance-summary.ts) и для записи «весь отдел» в
    // карте salesPerformanceByCategory (правила без категории —
    // ProductSold/UsedProductSold с config.category === null). null, если у
    // сотрудника нет отдела или для этого отдела ещё нет ни плана, ни факта
    // за период.
    async findSalesPerformance(
        period: Period,
        departmentId: number | null,
        category: string | null,
    ): Promise<ShopSalesPerformance | null> {
        if (departmentId == null) {
            return null;
        }
        return this.salesPerformanceReader.findForScope(
            period.getValue(),
            departmentId,
            category,
        );
    }

    // Карта category → ShopSalesPerformance (Фаза 2 плана
    // shop-sales-performance-by-category, закрывает issue #60) — по одному
    // findForScope на каждую уникальную category правил ProductSold/
    // UsedProductSold схемы (переиспользует categoryIds, собранный для
    // resolveCategoryDescendantFolderIds), плюс запись "весь отдел" под
    // ключом null из уже полученного departmentPerformance (второго похода
    // за category: null не делаем — тот же вызов уже нужен для
    // salesPerformanceDetail отчёта). Категория, для которой findForScope
    // не нашёл строки, в карту не попадает — fail closed на стороне
    // ProductSoldEntity (см. product-sold.entity.ts), а не здесь.
    private async resolveSalesPerformanceByCategory(
        period: Period,
        departmentId: number | null,
        categoryIds: Set<string>,
        departmentPerformance: ShopSalesPerformance | null,
    ): Promise<Map<string | null, ShopSalesPerformance>> {
        const result = new Map<string | null, ShopSalesPerformance>();
        if (departmentPerformance) {
            result.set(null, departmentPerformance);
        }
        if (categoryIds.size === 0) {
            return result;
        }
        const entries = await Promise.all(
            [...categoryIds].map(
                async (category) =>
                    [
                        category,
                        await this.findSalesPerformance(
                            period,
                            departmentId,
                            category,
                        ),
                    ] as const,
            ),
        );
        for (const [category, performance] of entries) {
            if (performance) {
                result.set(category, performance);
            }
        }
        return result;
    }

    // Лёгкий путь для попадания в ленивый кэш расчёта (зеркало
    // findSalesPerformanceForEmployee сервиса) — кэш хранит только строки
    // расчёта (CalculationLine[]), не сам ShopSalesPerformance, поэтому
    // компактный блок для ответа при кэш-хите достаётся отдельно, без
    // похода за тяжёлыми erpData-выборками (findProductSoldItems/...),
    // которые build() тянет за собой. Только "весь отдел" (category: null)
    // — при кэш-хите rule.calculate() заново не вызывается, поэтому карта
    // по категориям здесь не нужна, только компактный блок отчёта.
    async findSalesPerformanceForEmployee(
        period: Period,
        employeeId: number,
    ): Promise<ShopSalesPerformance | null> {
        const departmentId =
            await this.dataSource.findEmployeeDepartmentId(employeeId);
        return this.findSalesPerformance(period, departmentId, null);
    }

    // Все строки плана-факта-прогноза отдела за период (по каждой
    // заведённой категории) — сырой вход для построчной разбивки
    // "план продаж отдела" по категориям в ответе отчёта (см.
    // GetShopEmployeeSalaryReportService.buildSalesPerformanceSummaries).
    // У сотрудника без отдела в shop — пустой список, как и у
    // findSalesPerformance с departmentId === null.
    async findSalesPerformanceByDepartment(
        period: Period,
        departmentId: number | null,
    ): Promise<ShopSalesPerformance[]> {
        if (departmentId == null) {
            return [];
        }
        return this.salesPerformanceReader.listForDepartment(
            period.getValue(),
            departmentId,
        );
    }

    // Лёгкий путь для попадания в кэш (зеркало findSalesPerformanceForEmployee
    // выше) — резолвит отдел сотрудника перед тем, как звать
    // findSalesPerformanceByDepartment.
    async findSalesPerformanceByDepartmentForEmployee(
        period: Period,
        employeeId: number,
    ): Promise<ShopSalesPerformance[]> {
        const departmentId =
            await this.dataSource.findEmployeeDepartmentId(employeeId);
        return this.findSalesPerformanceByDepartment(period, departmentId);
    }

    // Implements FR2-FR3 of add-department-head-salary-rules (tasks.md раздел 13, зеркало service —
    // resolveDepartmentSalesPerformance у BuildServiceCalculationContextService).
    //
    // Карта fact/percentCompletion по уникальным category правил DepartmentPercent/
    // DepartmentPlanBonus переданной схемы — по одному findForScope на категорию (не связано с
    // salesPerformanceByCategory выше, которая резолвит категории ProductSold/UsedProductSold и
    // хранит полный ShopSalesPerformance, а не урезанный DepartmentSalesPerformanceEntry). null, если
    // у сотрудника нет отдела; пустая Map, если department есть, но в схеме нет ни одного правила
    // этих двух видов.
    private async resolveDepartmentSalesPerformance(
        period: Period,
        departmentId: number | null,
        rules: ShopSalaryRule[],
    ): Promise<DepartmentSalesPerformanceByCategory | null> {
        if (departmentId == null) {
            return null;
        }

        const categories =
            this.collectDepartmentSalesPerformanceCategories(rules);
        const result: DepartmentSalesPerformanceByCategory = new Map();
        if (categories.size === 0) {
            return result;
        }

        const entries = await Promise.all(
            [...categories].map(
                async (category) =>
                    [
                        category,
                        await this.salesPerformanceReader.findForScope(
                            period.getValue(),
                            departmentId,
                            category,
                        ),
                    ] as const,
            ),
        );
        for (const [category, performance] of entries) {
            if (performance) {
                result.set(
                    category,
                    this.toDepartmentSalesPerformanceEntry(performance),
                );
            }
        }
        return result;
    }

    private collectDepartmentSalesPerformanceCategories(
        rules: ShopSalaryRule[],
    ): Set<string | null> {
        const categories = new Set<string | null>();
        for (const rule of rules) {
            if (
                rule.type !== 'DepartmentPercent' &&
                rule.type !== 'DepartmentPlanBonus'
            ) {
                continue;
            }
            const config = rule.config as
                | DepartmentPercentShopSalaryConfig
                | DepartmentPlanBonusShopSalaryConfig;
            categories.add(config.category);
        }
        return categories;
    }

    private toDepartmentSalesPerformanceEntry(
        performance: ShopSalesPerformance,
    ): DepartmentSalesPerformanceEntry {
        const fact = performance.getFact();
        return {
            fact: { turnover: fact.getTurnover(), margin: fact.getMargin() },
            percentCompletion: fact.getPercentCompletion(),
        };
    }

    // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 13, зеркало service —
    // resolveTurnoverPerformance у BuildServiceCalculationContextService).
    //
    // Карта факт. коэффициента оборачиваемости по уникальным (warehouseId, category) скоупам правил
    // DepartmentTurnoverBonus переданной схемы — не зависит от department сотрудника (оборачиваемость
    // скоуплена по складу МойСклад, не по отделу). Значение null для scope записывается в карту явно.
    private async resolveTurnoverPerformance(
        period: Period,
        rules: ShopSalaryRule[],
    ): Promise<TurnoverPerformanceByScope> {
        const scopes = this.collectTurnoverPerformanceScopes(rules);
        const result: TurnoverPerformanceByScope = new Map();
        if (scopes.length === 0) {
            return result;
        }

        const entries = await Promise.all(
            scopes.map(
                async (scope) =>
                    [
                        turnoverPerformanceScopeKey(scope),
                        await this.turnoverPerformanceReader.findForScope(
                            period.getValue(),
                            scope.warehouseId,
                            scope.category,
                        ),
                    ] as const,
            ),
        );
        for (const [key, ratio] of entries) {
            result.set(key, ratio);
        }
        return result;
    }

    private collectTurnoverPerformanceScopes(
        rules: ShopSalaryRule[],
    ): TurnoverPerformanceScope[] {
        const seenKeys = new Set<string>();
        const scopes: TurnoverPerformanceScope[] = [];
        for (const rule of rules) {
            if (rule.type !== 'DepartmentTurnoverBonus') {
                continue;
            }
            const config = rule.config as DepartmentTurnoverBonusShopSalaryConfig;
            const scope: TurnoverPerformanceScope = {
                warehouseId: config.warehouseId,
                category: config.category,
            };
            const key = turnoverPerformanceScopeKey(scope);
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            scopes.push(scope);
        }
        return scopes;
    }
}

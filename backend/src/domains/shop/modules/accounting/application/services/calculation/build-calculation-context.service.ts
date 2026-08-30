import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { CalculationContextBuilder } from '@/domains/shop/modules/accounting/domain/services/calculation-context.builder';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';

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
    // TaskCompletedShopEntity.FloatPercent (у него категории нет вовсе) и
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
    ) {}

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
            confirmedTaskCompletions,
            departmentId,
        ] = await Promise.all([
            this.dataSource.findEmployeeIdentities(employeeId),
            this.dataSource.findHoursWorked(employeeId, period.getValue()),
            this.dataSource.findProductSoldItems(
                base.period.from,
                base.period.to,
            ),
            this.dataSource.findConfirmedTaskCompletions(period.getValue()),
            this.dataSource.findEmployeeDepartmentId(employeeId),
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

        const salesPerformanceByCategory =
            await this.resolveSalesPerformanceByCategory(
                period,
                departmentId,
                categoryIds,
                salesPerformanceDetail,
            );

        return {
            employee: { ...base.employee, identities },
            period: base.period,
            erpData: {
                hoursWorked,
                productSoldItems,
                categoryDescendantFolderIds,
                taskCompletions: confirmedTaskCompletions,
            } satisfies ShopCalculationErpData,
            salesPerformanceDetail,
            salesPerformanceByCategory,
            salesPerformanceByDepartment,
        };
    }

    // Уникальные category правил ProductSold/UsedProductSold схемы (issue
    // #60) — только у этих двух типов правил config несёт поле category,
    // остальные (PayPerHour/TaskCompleted) его не читают вовсе. Общий
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
    // TaskCompletedShopEntity.FloatPercent, ProductSold/UsedProductSold с
    // config.category === null). null, если у сотрудника нет отдела или для
    // этого отдела ещё нет ни плана, ни факта за период.
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
}

import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { buildBaseCalculationContext } from '@/domains/shop/modules/accounting/domain/services/calculation-context.builder';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/shop-calculation-data.types';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/shop-sales-performance.value-object';

// Базовый контекст расчёта направления shop, ещё не привязанный к
// конкретному режиму (FACT/PROGNOSE) — зеркало ServiceCalculationBaseContext
// (build-service-calculation-context.service.ts сервиса, Фаза 13.5, issue
// #57). salesPerformanceDetail несёт ПОЛНЫЙ агрегат ShopSalesPerformance
// (план+факт+прогноз), а не урезанный CalculationContext['salesPerformance']
// — по тем же двум причинам, что и у сервиса: один и тот же объект
// превращается в ДВА разных CalculationContext.salesPerformance (через
// to-shop-sales-performance-context.ts) и в компактный блок SalesPerformance
// в ответе отчёта (to-shop-sales-performance-summary.ts) — без второго
// похода в ShopSalesModule.
export interface ShopCalculationBaseContext {
    employee: CalculationContext['employee'];
    period: CalculationContext['period'];
    erpData: ShopCalculationErpData;
    salesPerformanceDetail: ShopSalesPerformance | null;
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
        const base = buildBaseCalculationContext('shop', period, employeeId);

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

        const categoryDescendantFolderIds =
            await this.resolveCategoryDescendantFolderIds(rules);

        const salesPerformanceDetail = await this.findSalesPerformance(
            period,
            departmentId,
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
        };
    }

    // Уникальные category правил ProductSold/UsedProductSold схемы (issue
    // #60) — только у этих двух типов правил config несёт поле category,
    // остальные (PayPerHour/TaskCompleted) его не читают вовсе. Один
    // батч-вызов resolveCategoryDescendantFolderIds на все уникальные
    // корневые папки схемы разом (см. ShopCalculationDataPort), а не по
    // одному на правило.
    private async resolveCategoryDescendantFolderIds(
        rules: ShopSalaryRule[],
    ): Promise<Record<string, string[]>> {
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
        if (categoryIds.size === 0) {
            return {};
        }
        return this.dataSource.resolveCategoryDescendantFolderIds([
            ...categoryIds,
        ]);
    }

    // Полный ShopSalesPerformance подразделения сотрудника — вход и для
    // расчёта FloatPercent (после выбора percentCompletion по режиму, см.
    // to-shop-sales-performance-context.ts), и для компактного блока в
    // ответе отчёта. null, если у сотрудника нет отдела или для этого
    // отдела ещё нет ни плана, ни факта за период — тогда FloatPercent-
    // правила сами бросают доменную ошибку, а остальные правила контекст не
    // используют и продолжают считать как обычно. category не передаём (null)
    // — ShopSalesPerformanceReaderPort.findForScope ищет по отделу целиком,
    // без привязки к конкретной категории правила (зеркало service-порта).
    async findSalesPerformance(
        period: Period,
        departmentId: number | null,
    ): Promise<ShopSalesPerformance | null> {
        if (departmentId == null) {
            return null;
        }
        return this.salesPerformanceReader.findForScope(
            period.getValue(),
            departmentId,
            null,
        );
    }

    // Лёгкий путь для попадания в ленивый кэш расчёта (зеркало
    // findSalesPerformanceForEmployee сервиса) — кэш хранит только строки
    // расчёта (CalculationLine[]), не сам ShopSalesPerformance, поэтому
    // компактный блок для ответа при кэш-хите достаётся отдельно, без
    // похода за тяжёлыми erpData-выборками (findProductSoldItems/...),
    // которые build() тянет за собой.
    async findSalesPerformanceForEmployee(
        period: Period,
        employeeId: number,
    ): Promise<ShopSalesPerformance | null> {
        const departmentId =
            await this.dataSource.findEmployeeDepartmentId(employeeId);
        return this.findSalesPerformance(period, departmentId);
    }
}

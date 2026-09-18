import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { buildBaseCalculationContext } from '@/domains/service/modules/accounting/domain/services/calculation-context.builder';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/calculation/service-calculation-data.port';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/calculation-data.types';
import { SALES_PERFORMANCE_READER } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';
import type {
    DepartmentPercentSalaryConfig,
    DepartmentPlanBonusSalaryConfig,
    DepartmentTurnoverBonusSalaryConfig,
    SalaryRule,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { buildTaskCompletionStatuses } from '@/domains/service/modules/accounting/application/services/calculation/task-completion-statuses.builder';
import { TURNOVER_PERFORMANCE_READER } from '@/domains/service/modules/accounting/application/ports/turnover-performance/turnover-performance.port';
import type { TurnoverPerformanceReaderPort } from '@/domains/service/modules/accounting/application/ports/turnover-performance/turnover-performance.port';
import type {
    DepartmentPerformanceOverrideByScope,
    DepartmentPerformanceOverrideScope,
    DepartmentSalesPerformanceByCategory,
    DepartmentSalesPerformanceEntry,
    TurnoverPerformanceByScope,
    TurnoverPerformanceScope,
} from '@/domains/service/modules/accounting/domain/types/calculation-context.types';
import {
    departmentPerformanceOverrideScopeKey,
    turnoverPerformanceScopeKey,
} from '@/domains/service/modules/accounting/domain/types/calculation-context.types';

// Базовый контекст расчёта направления service, ещё не привязанный к
// конкретному режиму (FACT/PROGNOSE, Фаза 9) — salesPerformanceDetail несёт
// ПОЛНЫЙ агрегат SalesPerformance (план+факт+прогноз), а не урезанный
// CalculationContext['salesPerformance'], по двум причинам: 1) один и тот
// же объект превращается в ДВА разных CalculationContext.salesPerformance —
// с fact.percentCompletion для режима FACT и с prognose.percentCompletion
// для PROGNOSE (см. to-sales-performance-context.ts); 2) тот же объект
// используется для компактного блока SalesPerformance в ответе отчёта
// (to-sales-performance-summary.ts) — без второго похода в SalesModule (см.
// PRD, раздел 6: "дублирующего расчёта плана внутри зарплатного модуля
// нет").
export interface ServiceCalculationBaseContext {
    employee: CalculationContext['employee'];
    period: CalculationContext['period'];
    erpData: ServiceCalculationErpData;
    salesPerformanceDetail: SalesPerformance | null;
    // Implements FR2-FR3 of add-department-head-salary-rules (tasks.md раздел 12, design.md
    // Decision 3) — факт (turnover/margin) + percentCompletion по СОБСТВЕННОЙ category каждого
    // DepartmentPercent/DepartmentPlanBonus правила переданной схемы (а не department целиком, как
    // salesPerformanceDetail выше). null, если у сотрудника нет отдела — тот же признак, что и у
    // salesPerformanceDetail. Мода FACT/PROGNOSE не различается (в отличие от
    // toSalesPerformanceContext) — новые виды правил читают факт напрямую, без прогнозного прохода.
    departmentSalesPerformance: DepartmentSalesPerformanceByCategory | null;
    // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 12) — факт. коэффициент
    // оборачиваемости по уникальным (warehouseId, category) скоупам DepartmentTurnoverBonus правил
    // схемы, ключ — turnoverPerformanceScopeKey(). Всегда Map (не null), пустая, если в схеме нет ни
    // одного такого правила.
    turnoverPerformance: TurnoverPerformanceByScope;
    // Временный костыль (см. WHY у DepartmentPercentSalaryConfig.departmentId/
    // DepartmentPlanBonusSalaryConfig.departmentId) — факт/percentCompletion по уникальным
    // (departmentId, category) скоупам ТЕХ ИЗ DepartmentPercent/DepartmentPlanBonus правил схемы, что
    // явно переопределили отдел (config.departmentId != null), ключ —
    // departmentPerformanceOverrideScopeKey(). Не зависит от собственного отдела сотрудника (в отличие
    // от departmentSalesPerformance выше) — по тому же принципу, что и turnoverPerformance. Всегда Map,
    // пустая, если в схеме нет ни одного правила с переопределённым отделом.
    departmentPerformanceOverrides: DepartmentPerformanceOverrideByScope;
}

// Application-слой сборки контекста расчёта направления service (Фаза 7) —
// единственное место, где erpData/employee.identities реально заполняются
// данными из БД. domain/services/calculation-context.builder.ts остаётся
// чистой функцией (скелет периода/сотрудника без похода в БД) — этот сервис
// оборачивает её, обогащая тем, что берёт из ServiceCalculationDataPort.
// Вызывается один раз на расчёт (см. PRD, "Контекст собирается один раз") —
// и открытым отчётом (GetEmployeeSalaryReportService), и закрытием периода
// (CloseAccountingPeriodHandler), чтобы сборка контекста не разошлась по
// двум местам.
@Injectable()
export class BuildServiceCalculationContextService {
    constructor(
        @Inject(SERVICE_CALCULATION_DATA)
        private readonly dataSource: ServiceCalculationDataPort,
        @Inject(SALES_PERFORMANCE_READER)
        private readonly salesPerformanceReader: SalesPerformanceReaderPort,
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
        // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 12).
        @Inject(TURNOVER_PERFORMANCE_READER)
        private readonly turnoverPerformanceReader: TurnoverPerformanceReaderPort,
    ) {}

    // replace-bitrix-task-integration, design.md решение 5 — rules: уже
    // разрешённый набор правил сотрудника (личных + отдела, см.
    // ResolveEmployeeSalaryRulesService), нужен только чтобы вычленить
    // TaskCompletion-правила и подтянуть SalaryTask текущего периода
    // (erpData.taskCompletionStatuses) через TASK_REPOSITORY.findManyByIds()
    // напрямую. Вызывающий (GetEmployeeSalaryReportService) уже резолвит
    // rules ДО построения контекста — не дублируем поход в
    // MotivationSchemaRepository здесь.
    async build(
        period: Period,
        employeeId: number,
        rules: SalaryRule[],
    ): Promise<ServiceCalculationBaseContext> {
        // 'service' захардкожен: этот сервис живёт в domains/service/modules/accounting
        // и не переиспользуется магазином (Фаза 12 заведёт для shop
        // независимую сборку контекста по своим данным, а не параметр
        // сюда — см. backend/CLAUDE.md, "зеркальные, но независимые"
        // модули доменов).
        const base = buildBaseCalculationContext('service', period, employeeId);

        const [
            identities,
            serviceCompletedItems,
            hoursWorked,
            orderPayedItems,
            departmentId,
            taskCompletionStatuses,
        ] = await Promise.all([
            this.dataSource.findEmployeeIdentities(employeeId),
            this.dataSource.findServiceCompletedItems(
                base.period.from,
                base.period.to,
            ),
            this.dataSource.findHoursWorked(employeeId, period.getValue()),
            this.dataSource.findOrderPayedItems(
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

        const [
            salesPerformanceDetail,
            departmentSalesPerformance,
            turnoverPerformance,
            departmentPerformanceOverrides,
        ] = await Promise.all([
            this.findSalesPerformance(period, departmentId),
            this.resolveDepartmentSalesPerformance(period, departmentId, rules),
            this.resolveTurnoverPerformance(period, rules),
            this.resolveDepartmentPerformanceOverrides(period, rules),
        ]);

        return {
            employee: { ...base.employee, identities },
            period: base.period,
            erpData: {
                serviceCompletedItems,
                hoursWorked,
                orderPayedItems,
                taskCompletionStatuses,
            },
            salesPerformanceDetail,
            departmentSalesPerformance,
            turnoverPerformance,
            departmentPerformanceOverrides,
        };
    }

    // Полный SalesPerformance подразделения сотрудника (Фаза 5/8/9) — вход
    // и для расчёта FloatPercent (после выбора percentCompletion по режиму,
    // см. to-sales-performance-context.ts), и для компактного блока в
    // ответе отчёта. null, если у сотрудника нет отдела или для этого
    // отдела ещё нет ни плана, ни факта за период — тогда FloatPercent-
    // правила сами бросают доменную ошибку (см.
    // SalesPerformanceRequiredException), а остальные правила контекст не
    // используют и продолжают считать как обычно.
    async findSalesPerformance(
        period: Period,
        departmentId: number | null,
    ): Promise<SalesPerformance | null> {
        if (departmentId == null) {
            return null;
        }
        return this.salesPerformanceReader.findForScope(
            'service',
            period.getValue(),
            departmentId,
            null,
        );
    }

    // Лёгкий путь для попадания в ленивый кэш расчёта (Фаза 9,
    // GetEmployeeSalaryReportService) — кэш хранит только строки расчёта
    // (CalculationLine[]), не сам SalesPerformance, поэтому компактный блок
    // для ответа при кэш-хите достаётся отдельно, без похода за тяжёлыми
    // erpData-выборками (findServiceCompletedItems/findOrderPayedItems/...),
    // которые build() тянет за собой.
    async findSalesPerformanceForEmployee(
        period: Period,
        employeeId: number,
    ): Promise<SalesPerformance | null> {
        const departmentId =
            await this.dataSource.findEmployeeDepartmentId(employeeId);
        return this.findSalesPerformance(period, departmentId);
    }

    // Implements FR2-FR3 of add-department-head-salary-rules (tasks.md раздел 12).
    //
    // Карта fact/percentCompletion по уникальным category правил DepartmentPercent/
    // DepartmentPlanBonus переданной схемы — по одному findForScope на категорию (не на правило: две
    // разные правила с одинаковой category делят один запрос), плюс сам departmentId. null, если у
    // сотрудника нет отдела вовсе (department для этих правил всегда implicit, design.md Decision 1)
    // — тогда запросов не делается совсем. Пустая Map, если department есть, но в схеме нет ни
    // одного правила этих двух видов.
    private async resolveDepartmentSalesPerformance(
        period: Period,
        departmentId: number | null,
        rules: SalaryRule[],
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
                            'service',
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
        rules: SalaryRule[],
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
                DepartmentPercentSalaryConfig | DepartmentPlanBonusSalaryConfig;
            // Правила с явным departmentId идут через
            // resolveDepartmentPerformanceOverrides/departmentPerformanceOverrides, а не через эту
            // implicit-по-своему-отделу карту — иначе один и тот же findForScope дублировался бы.
            if (config.departmentId != null) {
                continue;
            }
            categories.add(config.category);
        }
        return categories;
    }

    private toDepartmentSalesPerformanceEntry(
        performance: SalesPerformance,
    ): DepartmentSalesPerformanceEntry {
        const fact = performance.getFact();
        return {
            fact: { turnover: fact.getTurnover(), margin: fact.getMargin() },
            percentCompletion: fact.getPercentCompletion(),
        };
    }

    // Implements FR4 of add-department-head-salary-rules (tasks.md раздел 12).
    //
    // Карта факт. коэффициента оборачиваемости по уникальным (warehouseId, category) скоупам правил
    // DepartmentTurnoverBonus переданной схемы — по одному findForScope на скоуп (несколько правил с
    // одинаковым warehouseId+category делят один запрос). В отличие от
    // resolveDepartmentSalesPerformance, не зависит от department сотрудника вовсе (design.md
    // Decision 1/2 — оборачиваемость скоуплена по складу, не по отделу). Значение null для scope
    // записывается в карту явно (а не пропускается) — TurnoverPerformanceByScope несёт `number | null`
    // именно чтобы отличить "проверяли, данных нет" от "ещё не проверяли".
    private async resolveTurnoverPerformance(
        period: Period,
        rules: SalaryRule[],
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
                            this.toRoappCategoryId(scope.category),
                        ),
                    ] as const,
            ),
        );
        for (const [key, ratio] of entries) {
            result.set(key, ratio);
        }
        return result;
    }

    // Временный костыль (см. WHY у DepartmentPercentSalaryConfig.departmentId/
    // DepartmentPlanBonusSalaryConfig.departmentId) — зеркало resolveTurnoverPerformance выше: по
    // одному findForScope на уникальный (departmentId, category) скоуп ТЕХ ИЗ DepartmentPercent/
    // DepartmentPlanBonus правил, что явно переопределили отдел, а не implicit-правил (те по-прежнему
    // идут через resolveDepartmentSalesPerformance/собственный отдел сотрудника).
    private async resolveDepartmentPerformanceOverrides(
        period: Period,
        rules: SalaryRule[],
    ): Promise<DepartmentPerformanceOverrideByScope> {
        const scopes = this.collectDepartmentPerformanceOverrideScopes(rules);
        const result: DepartmentPerformanceOverrideByScope = new Map();
        if (scopes.length === 0) {
            return result;
        }

        const entries = await Promise.all(
            scopes.map(
                async (scope) =>
                    [
                        departmentPerformanceOverrideScopeKey(scope),
                        await this.salesPerformanceReader.findForScope(
                            'service',
                            period.getValue(),
                            scope.departmentId,
                            scope.category,
                        ),
                    ] as const,
            ),
        );
        for (const [key, performance] of entries) {
            if (performance) {
                result.set(
                    key,
                    this.toDepartmentSalesPerformanceEntry(performance),
                );
            }
        }
        return result;
    }

    private collectDepartmentPerformanceOverrideScopes(
        rules: SalaryRule[],
    ): DepartmentPerformanceOverrideScope[] {
        const seenKeys = new Set<string>();
        const scopes: DepartmentPerformanceOverrideScope[] = [];
        for (const rule of rules) {
            if (
                rule.type !== 'DepartmentPercent' &&
                rule.type !== 'DepartmentPlanBonus'
            ) {
                continue;
            }
            const config = rule.config as
                DepartmentPercentSalaryConfig | DepartmentPlanBonusSalaryConfig;
            if (config.departmentId == null) {
                continue;
            }
            const scope: DepartmentPerformanceOverrideScope = {
                departmentId: config.departmentId,
                category: config.category,
            };
            const key = departmentPerformanceOverrideScopeKey(scope);
            if (seenKeys.has(key)) {
                continue;
            }
            seenKeys.add(key);
            scopes.push(scope);
        }
        return scopes;
    }

    // PRE-EXISTING CROSS-GROUP TYPE GAP (discovered while implementing tasks.md раздел 12, not
    // introduced here — see final report): `DepartmentTurnoverBonusSalaryConfig.category` is
    // `string | null` end-to-end (contracts/commands/salary-rule.ts, calculation-context.types.ts,
    // TurnoverPerformanceScope) — the same generic scope-parameter shape used by every other
    // category field in this domain (SalesPlan.category, ProductSold.config.category,
    // DepartmentPercent/DepartmentPlanBonus.config.category). But service's turnover report rows
    // key categories by the numeric RoApp category id (roappProductCategory.id) —
    // TurnoverPerformanceReaderPort.findForScope/TurnoverReportSnapshot.ratioForCategory both take
    // `category: number | null` (see application/ports/turnover-performance/turnover-performance.port.ts,
    // domain/entities/turnover-report/turnover-report-snapshot.entity.ts — both from an earlier task
    // group). This bridges the two conventions at the one call site that needs both: a numeric-string
    // category parses to its RoApp id; `null` stays `null`; a non-numeric string (should not occur in
    // practice — the UI is expected to submit the RoApp category id as a string) resolves to `null`
    // (falls back to "insufficient data", design.md Q2 — never throws). Fixing this properly means
    // reconciling the config schema's category type with the turnover port's, which reaches into
    // contracts and an earlier group's entities/tests — flagged for a follow-up, not done here.
    private toRoappCategoryId(category: string | null): number | null {
        if (category === null) {
            return null;
        }
        const parsed = Number(category);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private collectTurnoverPerformanceScopes(
        rules: SalaryRule[],
    ): TurnoverPerformanceScope[] {
        const seenKeys = new Set<string>();
        const scopes: TurnoverPerformanceScope[] = [];
        for (const rule of rules) {
            if (rule.type !== 'DepartmentTurnoverBonus') {
                continue;
            }
            const config = rule.config as DepartmentTurnoverBonusSalaryConfig;
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

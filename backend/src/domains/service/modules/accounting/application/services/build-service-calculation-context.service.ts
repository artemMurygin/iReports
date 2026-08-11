import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { buildBaseCalculationContext } from '@/domains/service/modules/accounting/domain/services/calculation-context.builder';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SALES_PERFORMANCE_READER } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformance } from '@/domains/service/modules/sales/domain/value-objects/sales-performance.value-object';

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
    ) {}

    async build(
        period: Period,
        employeeId: number,
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
            confirmedTaskCompletions,
            departmentId,
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
            this.dataSource.findConfirmedTaskCompletions(period.getValue()),
            this.dataSource.findEmployeeDepartmentId(employeeId),
        ]);

        const salesPerformanceDetail = await this.findSalesPerformance(
            period,
            departmentId,
        );

        return {
            employee: { ...base.employee, identities },
            period: base.period,
            erpData: {
                serviceCompletedItems,
                hoursWorked,
                orderPayedItems,
                confirmedTaskCompletions,
            },
            salesPerformanceDetail,
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
}

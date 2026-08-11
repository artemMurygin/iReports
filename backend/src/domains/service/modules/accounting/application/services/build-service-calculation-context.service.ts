import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import type { SalesPerformanceContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { buildBaseCalculationContext } from '@/domains/service/modules/accounting/domain/services/calculation-context.builder';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { SALES_PERFORMANCE_READER } from '@/domains/service/modules/sales/application/ports/sales-performance.port';
import type { SalesPerformanceReaderPort } from '@/domains/service/modules/sales/application/ports/sales-performance.port';

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
    ): Promise<Omit<CalculationContext<ServiceCalculationErpData>, 'mode'>> {
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

        const salesPerformance = await this.buildSalesPerformance(
            period,
            departmentId,
        );

        return {
            ...base,
            employee: { ...base.employee, identities },
            erpData: {
                serviceCompletedItems,
                hoursWorked,
                orderPayedItems,
                confirmedTaskCompletions,
            },
            salesPerformance,
        };
    }

    // Вход FloatPercent (OrderPayed/TaskCompleted, Фаза 8) — процент
    // выполнения плана подразделения сотрудника. Значение берётся из
    // SalesFact.percentCompletion независимо от будущего режима расчёта
    // (FACT/PROGNOSE): полноценное разделение "в прогнозе — прогнозный
    // процент" — предмет Фазы 9 ("Режим расчёта FACT|PROGNOSE в
    // контексте"), которая владеет всей формой отчёта и различием между
    // проходами; здесь заранее фиксируется только то, от чего уже сейчас
    // зависит расчёт FloatPercent. null, если у сотрудника нет отдела или
    // для этого отдела ещё нет ни плана, ни факта за период — тогда
    // FloatPercent-правила сами бросают доменную ошибку (см.
    // SalesPerformanceRequiredException), а остальные правила контекст не
    // используют и продолжают считать как обычно.
    private async buildSalesPerformance(
        period: Period,
        departmentId: number | null,
    ): Promise<SalesPerformanceContext | null> {
        if (departmentId == null) {
            return null;
        }
        const performance = await this.salesPerformanceReader.findForScope(
            'service',
            period.getValue(),
            departmentId,
            null,
        );
        if (!performance) {
            return null;
        }
        return {
            department: departmentId,
            category: null,
            percentCompletion: performance.getFact().getPercentCompletion(),
        };
    }
}

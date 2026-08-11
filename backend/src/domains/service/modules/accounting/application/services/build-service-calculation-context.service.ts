import { Inject, Injectable } from '@nestjs/common';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { Period } from '@/shared/domain/period.value-object';
import { buildBaseCalculationContext } from '@/domains/service/modules/accounting/domain/services/calculation-context.builder';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationErpData } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';

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

        const [identities, serviceCompletedItems, hoursWorked] =
            await Promise.all([
                this.dataSource.findEmployeeIdentities(employeeId),
                this.dataSource.findServiceCompletedItems(
                    base.period.from,
                    base.period.to,
                ),
                this.dataSource.findHoursWorked(employeeId, period.getValue()),
            ]);

        return {
            ...base,
            employee: { ...base.employee, identities },
            erpData: { serviceCompletedItems, hoursWorked },
        };
    }
}

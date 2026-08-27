import { Injectable } from '@nestjs/common';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { EnsureBitrixTaskForPeriodService } from '@/domains/service/modules/accounting/application/services/ensure-bitrix-task-for-period.service';

// Ленивое достраивание задачи Bitrix24 регулярного правила TaskCompleted при
// чтении (задача 7.2 change salary-rule-bitrix-task, design.md Decision 5) —
// тот же приём, что ListSalesPlansService применяет к
// EnsureSalesPlansForPeriodService (Фаза 4, domains/service/modules/sales,
// см. WHY там): TaskRuleAutoCreationCron (задача 7.1, @ProdCron первого
// числа) реально тикает только в проде — в dev/после простоя месяц
// достраивается первым же чтением схемы мотивации или отчёта.
//
// Единая точка вызова EnsureBitrixTaskForPeriodService.ensure для всех трёх
// читающих сервисов (GetMotivationSchemaService/
// GetEmployeeSalaryReportService/GetDepartmentSalaryReportService) — без
// неё пришлось бы дублировать один и тот же instanceof-цикл трижды.
// ensure() сам по себе — no-op для разового правила и для правила, у
// которого уже есть задача на запрошенный период (см. WHY в
// ensure-bitrix-task-for-period.service.ts), поэтому вызывать его на каждое
// чтение безопасно и идемпотентно.
@Injectable()
export class EnsureTaskRulesOnReadService {
    constructor(
        private readonly ensureBitrixTask: EnsureBitrixTaskForPeriodService,
    ) {}

    async ensureAll(
        rules: SalaryRule[],
        employeeId: number,
        period: string,
    ): Promise<void> {
        for (const rule of rules) {
            if (rule instanceof TaskCompletedEntity) {
                await this.ensureBitrixTask.ensure(rule, period, employeeId);
            }
        }
    }
}

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetTaskRuleActualAmountCommand } from '@/domains/service/modules/accounting/application/command/set-task-rule-actual-amount.command';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../ports/salary-rule.port';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { BitrixTaskRuleStatusItem } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { toTaskRuleStatus } from '@/domains/service/modules/accounting/application/mappers/to-task-rule-status';
import {
    TaskRuleActualAmountOutOfRangeException,
    TaskRuleNotCompletedException,
    TaskRuleNotFoundException,
} from '@/domains/service/modules/accounting/domain/exceptions/task-rule.exception';
import { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';

// Requirement "Ручной ввод фактической суммы по закрытой задаче" (spec.md):
// 0 <= actualAmount <= сумма правила, запрет для статуса, отличного от
// "Закрыта", и для закрытого расчётного периода (см.
// EnsurePeriodNotClosedService — Requirement "Поле недоступно в закрытом
// периоде"). Запись — upsertActualAmount по period (задача 3.2,
// TaskCompletedEntity), в той же Prisma-транзакции, что и остальные
// одиночные записи этого модуля (SalaryRuleRepository.update оборачивает
// себя в PrismaRepository.write — отдельный unitOfWork.run() здесь не
// нужен, это ровно одна запись без сопутствующих операций).
@CommandHandler(SetTaskRuleActualAmountCommand)
export class SetTaskRuleActualAmountHandler implements ICommandHandler<
    SetTaskRuleActualAmountCommand,
    void
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        private readonly ensurePeriodNotClosed: EnsurePeriodNotClosedService,
        private readonly bitrixTasksService: BitrixTasksService,
    ) {}

    async execute(command: SetTaskRuleActualAmountCommand): Promise<void> {
        const rule = await this.salaryRuleRepo.findById(command.ruleId);
        if (!rule || !(rule instanceof TaskCompletedEntity)) {
            throw new TaskRuleNotFoundException(command.ruleId);
        }

        // Requirement "Поле недоступно в закрытом периоде" — проверяется
        // только для направления service: правило-задача этого модуля
        // всегда direction='service' (см. SalaryRuleRepository.findById).
        await this.ensurePeriodNotClosed.ensureNotClosed(command.period, [
            'service',
        ]);

        const rewardAmount = rule.rewardAmount.getValue();
        if (command.actualAmount < 0 || command.actualAmount > rewardAmount) {
            throw new TaskRuleActualAmountOutOfRangeException(
                command.actualAmount,
                rewardAmount,
            );
        }

        await this.ensureTaskCompletedForPeriod(rule, command);

        rule.upsertActualAmount(command.period, command.actualAmount);
        await this.salaryRuleRepo.update(rule);
    }

    // Requirement "Поле недоступно для незакрытой задачи" — статус читается
    // живьём из Bitrix24 (не из последнего расчёта отчёта: между открытием
    // страницы отчёта и сохранением ввода статус задачи мог измениться).
    private async ensureTaskCompletedForPeriod(
        rule: TaskCompletedEntity,
        command: SetTaskRuleActualAmountCommand,
    ): Promise<void> {
        const batch = await this.bitrixTasksService.getTasksBatch(
            rule.bitrixTaskIds,
        );
        const statusesByTaskId = new Map<number, BitrixTaskRuleStatusItem>(
            batch.map((item) => [
                item.id,
                {
                    id: item.id,
                    isAvailable: item.isAvailable,
                    status: toTaskRuleStatus(item.status),
                    period: item.period,
                },
            ]),
        );
        const matched = rule.findTaskForPeriod(
            statusesByTaskId,
            command.period,
        );
        if (!matched || matched.status !== 'COMPLETED') {
            throw new TaskRuleNotCompletedException(
                command.ruleId,
                command.period,
            );
        }
    }
}

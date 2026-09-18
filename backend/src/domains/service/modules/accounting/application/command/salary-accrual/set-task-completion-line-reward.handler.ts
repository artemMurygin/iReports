import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { TaskCompletionSalaryConfig } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { SalaryAccrualNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { SalaryAccrualMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { resolveEmployees } from '../../services/salary-accrual/list-salary-accruals.service';
import { SetTaskCompletionLineRewardCommand } from './set-task-completion-line-reward.command';

// Первичный ручной ввод суммы+комментария строки TaskCompletion (раздел 13
// tasks.md add-task-based-salary-rule, design.md Decision 5) — по образцу
// AdjustSalaryAccrualLineHandler: один агрегат, БЕЗ UNIT_OF_WORK — транзакцию
// открывает сам репозиторий (PrismaRepository.write).
//
// Только для строки в DRAFT с requiresManualInput === true (см.
// SalaryAccrualLine.setManualReward); комментарий обязателен и на границе
// HTTP (setTaskCompletionLineRewardRequestSchema), и в домене — 400 без него.
@CommandHandler(SetTaskCompletionLineRewardCommand)
export class SetTaskCompletionLineRewardHandler implements ICommandHandler<
    SetTaskCompletionLineRewardCommand,
    SalaryAccrualResponse
> {
    private readonly mapper = new SalaryAccrualMapper();

    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
    ) {}

    async execute(
        command: SetTaskCompletionLineRewardCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual || accrual.direction !== command.direction) {
            throw new SalaryAccrualNotFoundException(
                command.direction,
                command.accrualId,
            );
        }

        const line = accrual.setLineManualReward(
            command.lineId,
            command.amount,
            command.comment,
        );

        // Один агрегат — транзакцию открывает сам репозиторий
        // (PrismaRepository.write), отдельный UnitOfWork не нужен.
        await this.accrualRepo.save(accrual);

        // deactivate-one-off-task-completion-rule, design.md Decision 4 —
        // spec: service/accounting#requirement-разовое-правило-«за-выполнение-задачи»-деактивируется-по-исходу-задачи
        // (сценарий «Фиксация начисления деактивирует разовое правило»).
        // Разовое (isRecurring === false) правило TaskCompletion
        // деактивируется тем же вызовом, что сохраняет сумму — весь
        // контекст (rule) уже загружен здесь, отдельная транзакция/событие
        // не нужны (в отличие от неуспешного закрытия задачи, реагирующего
        // на TaskClosedDomainEvent из модуля tasks). Уже неактивное правило
        // и регулярное (isRecurring === true) не трогаются — идемпотентно и
        // симметрично DeactivateSalaryRuleHandler.
        const rule = await this.salaryRuleRepo.findById(line.ruleId);
        if (rule && rule.type === 'TaskCompletion' && rule.isActive) {
            const config = rule.config as TaskCompletionSalaryConfig;
            if (config.isRecurring === false) {
                rule.deactivate();
                await this.salaryRuleRepo.update(rule);
            }
        }

        const employees = await resolveEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

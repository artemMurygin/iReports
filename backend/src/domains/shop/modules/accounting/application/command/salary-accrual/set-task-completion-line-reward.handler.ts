import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ShopSalaryAccrualNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-accrual.exception';
import { ShopSalaryAccrualMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { TaskCompletionShopSalaryConfig } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { resolveShopEmployees } from '../../services/salary-accrual/list-salary-accruals.service';
import { SetShopTaskCompletionLineRewardCommand } from './set-task-completion-line-reward.command';

// Раздел 18 tasks.md (add-task-based-salary-rule) — зеркало
// domains/service/modules/accounting/application/command/
// set-task-completion-line-reward.handler.ts: первичный ручной ввод
// суммы+комментария строки TaskCompletion (design.md Decision 5), по образцу
// AdjustShopSalaryAccrualLineHandler — один агрегат, БЕЗ UNIT_OF_WORK
// (транзакцию открывает сам репозиторий, PrismaRepository.write).
//
// Только для строки в DRAFT с requiresManualInput === true (см.
// ShopSalaryAccrualLine.setManualReward); комментарий обязателен и на
// границе HTTP (setTaskCompletionLineRewardRequestSchema), и в домене — 400
// без него.
//
// Группа 7 tasks.md (deactivate-one-off-task-completion-rule), design.md
// Decision 4 — зеркало domains/service'ного SetTaskCompletionLineRewardHandler:
// фиксация фактической суммы начисления по РАЗОВОМУ (isRecurring: false)
// правилу деактивирует его в этой же операции (не отдельная транзакция/
// событие — правило уже загружается здесь же, по ruleId строки). Регулярное
// правило и уже неактивное разовое правило не трогаются — см.
// specs/shop/accounting/spec.md, Requirement «Разовое правило «за выполнение
// задачи» деактивируется по исходу задачи».
@CommandHandler(SetShopTaskCompletionLineRewardCommand)
export class SetShopTaskCompletionLineRewardHandler implements ICommandHandler<
    SetShopTaskCompletionLineRewardCommand,
    SalaryAccrualResponse
> {
    private readonly mapper = new ShopSalaryAccrualMapper();

    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: ShopSalaryRuleRepositoryPort,
    ) {}

    async execute(
        command: SetShopTaskCompletionLineRewardCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(command.accrualId);
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
        // spec: shop/accounting#requirement-разовое-правило-«за-выполнение-задачи»-деактивируется-по-исходу-задачи
        // (сценарий «Фиксация начисления деактивирует разовое правило»).
        // Разовое (isRecurring === false) правило TaskCompletion
        // деактивируется тем же вызовом, что сохраняет сумму — весь
        // контекст (rule) уже загружен здесь, отдельная транзакция/событие
        // не нужны (в отличие от неуспешного закрытия задачи, реагирующего
        // на TaskClosedDomainEvent из модуля tasks). Уже неактивное правило
        // и регулярное (isRecurring === true) не трогаются — идемпотентно и
        // симметрично DeactivateShopSalaryRuleHandler. Независимая
        // реализация, зеркальная domains/service'ному
        // SetTaskCompletionLineRewardHandler.
        const rule = await this.salaryRuleRepo.findById(line.ruleId);
        if (rule && rule.type === 'TaskCompletion' && rule.isActive) {
            const config = rule.config as TaskCompletionShopSalaryConfig;
            if (config.isRecurring === false) {
                rule.deactivate();
                await this.salaryRuleRepo.update(rule);
            }
        }

        const employees = await resolveShopEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                ShopSalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

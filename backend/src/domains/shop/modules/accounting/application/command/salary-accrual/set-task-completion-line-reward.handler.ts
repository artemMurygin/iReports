import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ShopSalaryAccrualNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-accrual.exception';
import { ShopSalaryAccrualMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
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
    ) {}

    async execute(
        command: SetShopTaskCompletionLineRewardCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(command.accrualId);
        }

        accrual.setLineManualReward(
            command.lineId,
            command.amount,
            command.comment,
        );

        // Один агрегат — транзакцию открывает сам репозиторий
        // (PrismaRepository.write), отдельный UnitOfWork не нужен.
        await this.accrualRepo.save(accrual);

        const employees = await resolveShopEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                ShopSalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

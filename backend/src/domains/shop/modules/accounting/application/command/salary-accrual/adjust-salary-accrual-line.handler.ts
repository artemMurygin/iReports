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
import { AdjustShopSalaryAccrualLineCommand } from './adjust-salary-accrual-line.command';

// Зеркало domains/service/modules/accounting/application/command/
// adjust-salary-accrual-line.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop.
@CommandHandler(AdjustShopSalaryAccrualLineCommand)
export class AdjustShopSalaryAccrualLineHandler implements ICommandHandler<
    AdjustShopSalaryAccrualLineCommand,
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
        command: AdjustShopSalaryAccrualLineCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(command.accrualId);
        }

        accrual.adjustLine(
            command.lineId,
            command.amount,
            command.comment,
            command.adjustedBy,
        );

        await this.accrualRepo.save(accrual);

        const employees = await resolveShopEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                ShopSalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

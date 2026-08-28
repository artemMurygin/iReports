import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ShopSalaryAccrualNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-salary-accrual.exception';
import {
    toShopSalaryAccrualResponse,
    unknownShopEmployeeInfo,
} from '../mappers/to-shop-salary-accrual-response';
import { resolveShopEmployees } from '../services/list-shop-salary-accruals.service';
import { UnaccrueShopSalaryAccrualLineCommand } from './unaccrue-shop-salary-accrual-line.command';

// Зеркало domains/service/modules/accounting/application/command/
// unaccrue-salary-accrual-line.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop.
@CommandHandler(UnaccrueShopSalaryAccrualLineCommand)
export class UnaccrueShopSalaryAccrualLineHandler implements ICommandHandler<
    UnaccrueShopSalaryAccrualLineCommand,
    SalaryAccrualResponse
> {
    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(
        command: UnaccrueShopSalaryAccrualLineCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(command.accrualId);
        }

        const line = accrual.unaccrueLine(command.lineId);

        await this.unitOfWork.run(async () => {
            await this.transactionRepo.deleteAccrualTransactionsByLineId(
                line.id,
            );
            await this.accrualRepo.save(accrual);
        });

        const employees = await resolveShopEmployees(this.directoryRepo);
        return toShopSalaryAccrualResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                unknownShopEmployeeInfo(accrual.employeeId),
        );
    }
}

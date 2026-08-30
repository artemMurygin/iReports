import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { ShopSalaryAccrualNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-accrual.exception';
import { ShopSalaryAccrualMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { resolveShopEmployees } from '../../services/salary-accrual/list-salary-accruals.service';
import { AccrueShopSalaryAccrualLineCommand } from './accrue-salary-accrual-line.command';

// Зеркало domains/service/modules/accounting/application/command/
// accrue-salary-accrual-line.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop: собственные
// SHOP_SALARY_ACCRUAL_REPOSITORY/ShopSalaryAccrual вместо
// SALARY_ACCRUAL_REPOSITORY/SalaryAccrual сервиса.
// BALANCE_TRANSACTION_REPOSITORY по-прежнему из сквозного employee-balance
// (баланс общий по сотруднику, см. backend/CLAUDE.md) —
// BalanceTransaction.forAccruedLine() принимает ShopSalaryAccrual/
// ShopSalaryAccrualLine структурно (см. WHY в balance-transaction.entity.ts),
// не через прямой импорт классов service.
@CommandHandler(AccrueShopSalaryAccrualLineCommand)
export class AccrueShopSalaryAccrualLineHandler implements ICommandHandler<
    AccrueShopSalaryAccrualLineCommand,
    SalaryAccrualResponse
> {
    private readonly mapper = new ShopSalaryAccrualMapper();

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
        command: AccrueShopSalaryAccrualLineCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(command.accrualId);
        }

        const line = accrual.accrueLine(command.lineId);
        const transactions = BalanceTransaction.forAccruedLine(
            accrual,
            line,
            command.accruedBy,
        );

        await this.unitOfWork.run(async () => {
            await this.transactionRepo.insertMany(transactions);
            await this.accrualRepo.save(accrual);
        });

        const employees = await resolveShopEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                ShopSalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

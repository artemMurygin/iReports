import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { SalaryAccrualNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import {
    toSalaryAccrualResponse,
    unknownEmployeeInfo,
} from '../mappers/to-salary-accrual-response';
import { resolveEmployees } from '../services/list-salary-accruals.service';
import { UnaccrueSalaryAccrualLineCommand } from './unaccrue-salary-accrual-line.command';

// Отмена начисления строки (PRD 2 docs/payroll-closing-and-accrual, Фаза 6):
// движения SALARY_ACCRUAL и ACCRUAL_ADJUSTMENT, созданные проведением этой
// строки, УДАЛЯЮТСЯ с баланса — не сторнируются: начисление до выплаты —
// черновик расчёта, а не факт движения денег, поэтому след в ленте ему не
// нужен (единственное исключение из неизменяемости ленты, см. PRD 2).
// Строка возвращается в DRAFT и снова доступна для корректировки и
// проведения; статус документа пересчитывается. Удаление движений и смена
// статусов — одна транзакция UnitOfWork.
//
// Отмена запрещена, если документ уже выплачен (PAID, PRD 3) — 409 через
// SalaryAccrual.unaccrueLine; отмена непроведённой строки — тоже 409.
@CommandHandler(UnaccrueSalaryAccrualLineCommand)
export class UnaccrueSalaryAccrualLineHandler implements ICommandHandler<
    UnaccrueSalaryAccrualLineCommand,
    SalaryAccrualResponse
> {
    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(
        command: UnaccrueSalaryAccrualLineCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual || accrual.direction !== command.direction) {
            throw new SalaryAccrualNotFoundException(
                command.direction,
                command.accrualId,
            );
        }

        const line = accrual.unaccrueLine(command.lineId);

        await this.unitOfWork.run(async () => {
            await this.transactionRepo.deleteAccrualTransactionsByLineId(
                line.id,
            );
            await this.accrualRepo.save(accrual);
        });

        const employees = await resolveEmployees(this.directoryRepo);
        return toSalaryAccrualResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

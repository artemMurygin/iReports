import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type {
    PayoutBatchOutcome,
    PayoutBatchResponse,
} from 'ireports-contracts';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { resolveEmployees } from '../services/list-salary-accruals.service';
import { unknownEmployeeInfo } from '../mappers/to-salary-accrual-response';
import { CreatePayoutCommand } from './create-payout.command';
import { CreatePayoutBatchCommand } from './create-payout-batch.command';

// Массовая выплата направления service (PRD 3, «День выплаты» и «Критерии
// готовности»: «результат содержит перечень успешных и неудачных»):
// по каждому сотруднику — свой остаток на МОМЕНТ операции (не из тела
// запроса), своя выплата (диспатч CreatePayoutCommand — своя транзакция
// UnitOfWork и своя блокировка по сотруднику на строку, тот же приём, что
// accrueDraftLines у массового проведения начислений). Один упавший
// сотрудник не останавливает остальных — ошибка попадает в outcomes как
// FAILED, обработка продолжается.
//
// РЕШЕНИЕ по нулевому/отрицательному остатку в батче (PRD не описывает этот
// случай буквально для массовой операции): «выплата на остаток» при
// balance ≤ 0 означала бы amount ≤ 0, что запрещено инвариантом
// BalanceTransaction.forPayout («amount > 0» — платить нечем, отрицательная
// выплата не имеет смысла). Такой сотрудник ВСЕГДА попадает в
// NEEDS_CONFIRMATION (не в FAILED — это не ошибка, а ожидаемая пауза, PRD 3:
// «сотрудники с нулевым/отрицательным остатком перечислены в подтверждении
// отдельно») независимо от confirmNegativeBalance — в отличие от одиночной
// выплаты (CreatePayoutHandler), где confirmNegativeBalance разблокирует
// оплату ПРОИЗВОЛЬНОЙ суммы, в батче нет отдельно введённой суммы, которую
// можно было бы подтвердить: подтверждать нечего, кроме факта «этот
// сотрудник не будет оплачен в этом батче». confirmNegativeBalance
// принимается контрактом (для формы на фронтенде и на случай будущего
// расширения), но не меняет исход для этой категории сотрудников — граница
// решения, а не недосмотр.
@CommandHandler(CreatePayoutBatchCommand)
export class CreatePayoutBatchHandler implements ICommandHandler<
    CreatePayoutBatchCommand,
    PayoutBatchResponse
> {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: CreatePayoutBatchCommand,
    ): Promise<PayoutBatchResponse> {
        const employees = await resolveEmployees(this.directoryRepo);
        const outcomes: PayoutBatchOutcome[] = [];
        let paidCount = 0;
        let totalPaidAmount = 0;

        for (const employeeId of command.employeeIds) {
            const employeeName = (
                employees.get(employeeId) ?? unknownEmployeeInfo(employeeId)
            ).name;
            const balance =
                await this.transactionRepo.sumByEmployee(employeeId);

            if (balance <= 0) {
                outcomes.push({
                    employeeId,
                    employeeName,
                    status: 'NEEDS_CONFIRMATION',
                    balance,
                    amount: null,
                    message:
                        'Остаток нулевой или отрицательный — платить нечем, ' +
                        'выплата в массовой операции не создаётся',
                });
                continue;
            }

            try {
                await this.commandBus.execute(
                    new CreatePayoutCommand({
                        employeeId,
                        amount: balance,
                        createdBy: command.createdBy,
                        comment: command.comment,
                        occurredAt: command.occurredAt,
                    }),
                );
                outcomes.push({
                    employeeId,
                    employeeName,
                    status: 'PAID',
                    balance,
                    amount: balance,
                    message: null,
                });
                paidCount += 1;
                totalPaidAmount += balance;
            } catch (error) {
                outcomes.push({
                    employeeId,
                    employeeName,
                    status: 'FAILED',
                    balance,
                    amount: null,
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            }
        }

        return {
            direction: 'service',
            outcomes,
            paidCount,
            totalPaidAmount,
        };
    }
}

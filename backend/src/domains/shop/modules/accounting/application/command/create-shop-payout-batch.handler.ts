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
import { resolveEmployees } from '@/domains/service/modules/accounting/application/services/list-salary-accruals.service';
import { unknownEmployeeInfo } from '@/domains/service/modules/accounting/application/mappers/to-salary-accrual-response';
import { CreateShopPayoutCommand } from './create-shop-payout.command';
import { CreateShopPayoutBatchCommand } from './create-shop-payout-batch.command';

// Массовая выплата направления shop (PRD 3, «День выплаты» и «Критерии
// готовности») — зеркалит CreatePayoutBatchHandler направления service (см.
// domains/service/modules/accounting/application/command/create-payout-batch.handler.ts),
// собственный класс по той же причине, что и CreateShopPayoutHandler:
// диспатчит CreateShopPayoutCommand (не CreatePayoutCommand service) — своя
// транзакция UnitOfWork и своя блокировка по сотруднику на каждого. Один
// упавший сотрудник не останавливает остальных — ошибка попадает в outcomes
// как FAILED.
//
// resolveEmployees/unknownEmployeeInfo — переиспользованы из domains/service
// напрямую: это справочник Bitrix (DIRECTORY_REPOSITORY), общий на компанию,
// а не бизнес-правило зарплаты магазина (тот же приём, что erp-cash-sync.helper
// в CreateShopPayoutHandler).
//
// РЕШЕНИЕ по нулевому/отрицательному остатку в батче — см. WHY в
// CreatePayoutBatchHandler направления service: такой сотрудник ВСЕГДА
// попадает в NEEDS_CONFIRMATION независимо от confirmNegativeBalance —
// платить в массовой операции просто нечего (amount ≤ 0 запрещён
// инвариантом BalanceTransaction.forPayout).
@CommandHandler(CreateShopPayoutBatchCommand)
export class CreateShopPayoutBatchHandler implements ICommandHandler<
    CreateShopPayoutBatchCommand,
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
        command: CreateShopPayoutBatchCommand,
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
                    new CreateShopPayoutCommand({
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
            direction: 'shop',
            outcomes,
            paidCount,
            totalPaidAmount,
        };
    }
}

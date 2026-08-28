import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type {
    PayoutBatchOutcome,
    PayoutBatchResponse,
} from 'ireports-contracts';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { resolveShopEmployees } from '@/domains/shop/modules/accounting/application/services/list-shop-salary-accruals.service';
import { unknownShopEmployeeInfo } from '@/domains/shop/modules/accounting/application/mappers/to-shop-salary-accrual-response';
import { CreateShopPayoutCommand } from './create-shop-payout.command';
import { CreateShopPayoutBatchCommand } from './create-shop-payout-batch.command';

// РЕШЕНИЕ (docs/employee-settlements-page-redesign, Фаза 6) — зеркалит WHY в
// CreatePayoutBatchHandler направления service: массовая выплата остаётся
// без UI (макеты её не показывают), но эндпоинт (эта команда/хендлер,
// POST .../payout/batch) не удалён и остаётся рабочим/тестируемым — решение
// отложено, см. PRD «Технические ограничения».

// Массовая выплата направления shop (PRD 3, «День выплаты» и «Критерии
// готовности») — зеркалит CreatePayoutBatchHandler направления service (см.
// domains/service/modules/accounting/application/command/create-payout-batch.handler.ts),
// собственный класс по той же причине, что и CreateShopPayoutHandler:
// диспатчит CreateShopPayoutCommand (не CreatePayoutCommand service) — своя
// транзакция UnitOfWork и своя блокировка по сотруднику на каждого. Один
// упавший сотрудник не останавливает остальных — ошибка попадает в outcomes
// как FAILED.
//
// resolveShopEmployees/unknownShopEmployeeInfo — собственные независимые
// копии domains/shop (Фаза 6 docs/service-shop-boundary-violations-fix), а
// не переиспользование domains/service (справочник Bitrix сам по себе общий
// на компанию, но обёртки над ним теперь раздельные по доменам, как и
// SalaryAccrual).
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
        const employees = await resolveShopEmployees(this.directoryRepo);
        const outcomes: PayoutBatchOutcome[] = [];
        let paidCount = 0;
        let totalPaidAmount = 0;

        for (const employeeId of command.employeeIds) {
            const employeeName = (
                employees.get(employeeId) ?? unknownShopEmployeeInfo(employeeId)
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

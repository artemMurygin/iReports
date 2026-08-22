import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { BalanceTransaction as BalanceTransactionContract } from 'ireports-contracts';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import { toBalanceTransactionResponse } from '../mappers/to-balance-transaction-response';
import { CreateBalanceTransactionCommand } from './create-balance-transaction.command';

// Ручное движение руководителя (PRD 2, Фаза 7): единственный способ
// провести деньги мимо документов начисления. Знак — по типу, для
// ADJUSTMENT — явно; обязательный комментарий для PENALTY/ADJUSTMENT
// проверяется контрактом (400 на границе HTTP) и в домене
// (BalanceTransaction.validate). Дата задним числом разрешена — движение с
// датой внутри закрытого месяца просто записывается в ленту: снапшот и
// документы начисления закрытого периода этот путь не читает и не меняет.
// Лимитов на аванс нет — остаток не проверяется, отрицательный баланс —
// штатная ситуация. erpSyncRequired только сохраняется (PRD 3 переведёт
// создание таких движений на порядок «ERP → транзакция → компенсация»).
@CommandHandler(CreateBalanceTransactionCommand)
export class CreateBalanceTransactionHandler implements ICommandHandler<
    CreateBalanceTransactionCommand,
    BalanceTransactionContract
> {
    constructor(
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
    ) {}

    async execute(
        command: CreateBalanceTransactionCommand,
    ): Promise<BalanceTransactionContract> {
        const transaction = BalanceTransaction.createManual({
            employeeId: command.employeeId,
            direction: command.direction,
            type: command.type,
            amount: command.amount,
            occurredAt: command.occurredAt,
            createdBy: command.createdBy,
            comment: command.comment,
            period: command.period,
            erpSyncRequired: command.erpSyncRequired,
        });

        await this.transactionRepo.insertMany([transaction]);

        return toBalanceTransactionResponse(transaction);
    }
}

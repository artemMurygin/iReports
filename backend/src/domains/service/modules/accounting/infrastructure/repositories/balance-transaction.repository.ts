import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';
import type {
    BalanceTransactionFilter,
    BalanceTransactionRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
import { SalaryAccrualLineAlreadyAccruedException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { BalanceTransactionMapper } from '../mappers/balance-transaction.mapper';

@Injectable()
export class BalanceTransactionRepository
    extends PrismaRepository
    implements BalanceTransactionRepositoryPort
{
    private readonly mapper = new BalanceTransactionMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insertMany(transactions: BalanceTransaction[]): Promise<void> {
        if (transactions.length === 0) {
            return;
        }
        try {
            await this.write(null, (client) =>
                client.balanceTransaction.createMany({
                    data: transactions.map((transaction) =>
                        this.mapper.toPersistence(transaction),
                    ),
                }),
            );
        } catch (error) {
            // Уникальный индекс (lineId, type) — идемпотентность проведения
            // строки на уровне БД (PRD 2): параллельный повторный accrue
            // упирается сюда, а не создаёт второе движение. Транзакция
            // UnitOfWork при этом откатывается целиком — статус строки тоже
            // не меняется.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const lineId = transactions.find(
                    (transaction) => transaction.lineId,
                )?.lineId;
                throw new SalaryAccrualLineAlreadyAccruedException(
                    lineId ?? 'unknown',
                );
            }
            throw error;
        }
    }

    async deleteAccrualTransactionsByLineId(lineId: string): Promise<void> {
        await this.write(null, (client) =>
            client.balanceTransaction.deleteMany({
                where: {
                    lineId,
                    type: { in: ['SALARY_ACCRUAL', 'ACCRUAL_ADJUSTMENT'] },
                },
            }),
        );
    }

    async findByEmployee(
        direction: AccountingDirection,
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransaction[]> {
        const records = await this.client.balanceTransaction.findMany({
            where: {
                direction,
                employeeId,
                ...(filter.from || filter.to
                    ? {
                          occurredAt: {
                              ...(filter.from ? { gte: filter.from } : {}),
                              ...(filter.to ? { lte: filter.to } : {}),
                          },
                      }
                    : {}),
                ...(filter.types ? { type: { in: filter.types } } : {}),
            },
            orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async sumByEmployee(
        direction: AccountingDirection,
        employeeId: number,
    ): Promise<number> {
        const aggregate = await this.client.balanceTransaction.aggregate({
            where: { direction, employeeId },
            _sum: { amount: true },
        });
        return aggregate._sum.amount ?? 0;
    }

    async findReversedIds(transactionIds: string[]): Promise<Set<string>> {
        if (transactionIds.length === 0) {
            return new Set();
        }
        const records = await this.client.balanceTransaction.findMany({
            where: {
                type: 'MANUAL_REVERSAL',
                reversedTransactionId: { in: transactionIds },
            },
            select: { reversedTransactionId: true },
        });
        return new Set(
            records
                .map((record) => record.reversedTransactionId)
                .filter((id): id is string => Boolean(id)),
        );
    }
}

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
import { BalanceTransactionAlreadyReversedException } from '@/domains/service/modules/accounting/domain/exceptions/balance-transaction.exception';
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
            // Два уникальных ограничения — две идемпотентности уровня БД:
            // (lineId, type) — проведение строки (PRD 2, параллельный
            // повторный accrue не создаёт второго движения), уникальный
            // reversedTransactionId — сторно (Фаза 7, параллельный reverse
            // не создаёт второго MANUAL_REVERSAL). Батч однороден (либо
            // движения проведения строки, либо одно сторно), поэтому
            // конфликт различаем по содержимому батча.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                const reversal = transactions.find(
                    (transaction) => transaction.reversedTransactionId,
                );
                if (reversal) {
                    throw new BalanceTransactionAlreadyReversedException(
                        reversal.reversedTransactionId!,
                    );
                }
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

    async findById(id: string): Promise<BalanceTransaction | null> {
        const record = await this.client.balanceTransaction.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
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

    async sumByEmployees(
        direction: AccountingDirection,
        employeeIds: number[],
    ): Promise<Map<number, number>> {
        if (employeeIds.length === 0) {
            return new Map();
        }
        const groups = await this.client.balanceTransaction.groupBy({
            by: ['employeeId'],
            where: { direction, employeeId: { in: employeeIds } },
            _sum: { amount: true },
        });
        return new Map(
            groups.map((group) => [group.employeeId, group._sum.amount ?? 0]),
        );
    }

    async findForDepartmentSummary(
        direction: AccountingDirection,
        employeeIds: number[],
        period: string,
        monthStart: Date,
        monthEnd: Date,
    ): Promise<BalanceTransaction[]> {
        if (employeeIds.length === 0) {
            return [];
        }
        const records = await this.client.balanceTransaction.findMany({
            where: {
                direction,
                employeeId: { in: employeeIds },
                OR: [
                    { occurredAt: { gte: monthStart, lte: monthEnd } },
                    { period },
                ],
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
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

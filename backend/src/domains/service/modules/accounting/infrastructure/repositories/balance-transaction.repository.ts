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
            // Уникальное ограничение (lineId, type) — идемпотентность
            // проведения строки уровня БД (PRD 2): параллельный повторный
            // accrue не создаёт второго движения, P2002 мапится в тот же
            // 409 «строка уже проведена», что и прямой повтор.
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

    async deleteById(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.balanceTransaction.deleteMany({ where: { id } }),
        );
    }

    async findByEmployee(
        employeeId: number,
        filter: BalanceTransactionFilter,
    ): Promise<BalanceTransaction[]> {
        const records = await this.client.balanceTransaction.findMany({
            where: {
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

    async sumByEmployee(employeeId: number): Promise<number> {
        const aggregate = await this.client.balanceTransaction.aggregate({
            where: { employeeId },
            _sum: { amount: true },
        });
        return aggregate._sum.amount ?? 0;
    }

    async sumByEmployees(employeeIds: number[]): Promise<Map<number, number>> {
        if (employeeIds.length === 0) {
            return new Map();
        }
        const groups = await this.client.balanceTransaction.groupBy({
            by: ['employeeId'],
            where: { employeeId: { in: employeeIds } },
            _sum: { amount: true },
        });
        return new Map(
            groups.map((group) => [group.employeeId, group._sum.amount ?? 0]),
        );
    }

    async findForDepartmentSummary(
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
                employeeId: { in: employeeIds },
                OR: [
                    { occurredAt: { gte: monthStart, lte: monthEnd } },
                    { period },
                ],
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}

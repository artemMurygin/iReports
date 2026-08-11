import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import {
    AccountingPeriodSnapshotPort,
    AccountingPeriodSnapshotRow,
} from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { RuleBreakdownLine } from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

@Injectable()
export class AccountingPeriodSnapshotRepository
    extends PrismaRepository
    implements AccountingPeriodSnapshotPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async saveAll(
        periodId: string,
        direction: AccountingDirection,
        period: string,
        rows: AccountingPeriodSnapshotRow[],
    ): Promise<void> {
        // Обе операции уже идут внутри транзакции, которую открывает
        // write() (см. PrismaRepository.write/DatabaseService.withTransaction)
        // — client здесь Prisma.TransactionClient, у него нет собственного
        // $transaction(), поэтому просто два последовательных вызова, а не
        // вложенный client.$transaction([...]).
        await this.write(null, async (client) => {
            await client.accountingPeriodSnapshot.deleteMany({
                where: { direction, period },
            });
            if (rows.length > 0) {
                await client.accountingPeriodSnapshot.createMany({
                    data: rows.map((row) => ({
                        id: randomUUID(),
                        periodId,
                        direction,
                        period,
                        employeeId: row.employeeId,
                        total: row.total,
                        lines: row.lines as unknown as Prisma.InputJsonValue,
                    })),
                });
            }
        });
    }

    async findByKey(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<AccountingPeriodSnapshotRow | null> {
        const record = await this.client.accountingPeriodSnapshot.findUnique({
            where: {
                direction_period_employeeId: { direction, period, employeeId },
            },
        });
        if (!record) {
            return null;
        }
        return {
            employeeId: record.employeeId,
            total: record.total,
            lines: record.lines as unknown as RuleBreakdownLine[],
        };
    }

    async deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void> {
        await this.write(null, (client) =>
            client.accountingPeriodSnapshot.deleteMany({
                where: { direction, period },
            }),
        );
    }
}

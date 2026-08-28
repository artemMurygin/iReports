import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import {
    ShopAccountingPeriodSnapshotPort,
    ShopAccountingPeriodSnapshotRow,
} from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period-snapshot.port';
import { RuleBreakdownLine } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// accounting-period-snapshot.repository.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop: та же общая Prisma-таблица accounting_period_snapshots,
// но всегда с фиксированным direction: 'shop'.
@Injectable()
export class ShopAccountingPeriodSnapshotRepository
    extends PrismaRepository
    implements ShopAccountingPeriodSnapshotPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async saveAll(
        periodId: string,
        period: string,
        rows: ShopAccountingPeriodSnapshotRow[],
    ): Promise<void> {
        // Обе операции уже идут внутри транзакции, которую открывает
        // write() (см. PrismaRepository.write/DatabaseService.withTransaction)
        // — client здесь Prisma.TransactionClient, у него нет собственного
        // $transaction(), поэтому просто два последовательных вызова, а не
        // вложенный client.$transaction([...]).
        await this.write(null, async (client) => {
            await client.accountingPeriodSnapshot.deleteMany({
                where: { direction: 'shop', period },
            });
            if (rows.length > 0) {
                await client.accountingPeriodSnapshot.createMany({
                    data: rows.map((row) => ({
                        id: randomUUID(),
                        periodId,
                        direction: 'shop',
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
        period: string,
        employeeId: number,
    ): Promise<ShopAccountingPeriodSnapshotRow | null> {
        const record = await this.client.accountingPeriodSnapshot.findUnique({
            where: {
                direction_period_employeeId: {
                    direction: 'shop',
                    period,
                    employeeId,
                },
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

    async findManyByKey(
        period: string,
        employeeIds: number[],
    ): Promise<Map<number, ShopAccountingPeriodSnapshotRow>> {
        const map = new Map<number, ShopAccountingPeriodSnapshotRow>();
        if (employeeIds.length === 0) {
            return map;
        }
        const records = await this.client.accountingPeriodSnapshot.findMany({
            where: {
                direction: 'shop',
                period,
                employeeId: { in: employeeIds },
            },
        });
        for (const record of records) {
            map.set(record.employeeId, {
                employeeId: record.employeeId,
                total: record.total,
                lines: record.lines as unknown as RuleBreakdownLine[],
            });
        }
        return map;
    }

    async deleteByPeriod(period: string): Promise<void> {
        await this.write(null, (client) =>
            client.accountingPeriodSnapshot.deleteMany({
                where: { direction: 'shop', period },
            }),
        );
    }
}

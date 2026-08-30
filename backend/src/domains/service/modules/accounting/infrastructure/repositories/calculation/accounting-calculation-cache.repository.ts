import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import {
    AccountingCalculationCacheEntry,
    AccountingCalculationCachePort,
} from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Не агрегат — таблица-кэш без доменных событий и инвариантов, поэтому
// write(null, ...) как и в SalesPlanRepository.delete() (см. образец).
@Injectable()
export class AccountingCalculationCacheRepository
    extends PrismaRepository
    implements AccountingCalculationCachePort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async find(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<AccountingCalculationCacheEntry | null> {
        const record = await this.client.accountingCalculationCache.findUnique({
            where: {
                direction_period_employeeId: {
                    direction,
                    period,
                    employeeId,
                },
            },
        });
        if (!record) {
            return null;
        }
        return {
            freshnessStamp: record.freshnessStamp,
            factLines: record.factLines as unknown as CalculationLine[],
            prognoseLines: record.prognoseLines as unknown as CalculationLine[],
            factTotal: record.factTotal,
            prognoseTotal: record.prognoseTotal,
        };
    }

    async upsert(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
        entry: AccountingCalculationCacheEntry,
    ): Promise<void> {
        const data = {
            direction,
            period,
            employeeId,
            freshnessStamp: entry.freshnessStamp,
            factTotal: entry.factTotal,
            prognoseTotal: entry.prognoseTotal,
            factLines: entry.factLines as unknown as Prisma.InputJsonValue,
            prognoseLines:
                entry.prognoseLines as unknown as Prisma.InputJsonValue,
        };
        await this.write(null, (client) =>
            client.accountingCalculationCache.upsert({
                where: {
                    direction_period_employeeId: {
                        direction,
                        period,
                        employeeId,
                    },
                },
                create: { id: randomUUID(), ...data },
                update: data,
            }),
        );
    }

    async deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void> {
        await this.write(null, (client) =>
            client.accountingCalculationCache.deleteMany({
                where: { direction, period },
            }),
        );
    }
}

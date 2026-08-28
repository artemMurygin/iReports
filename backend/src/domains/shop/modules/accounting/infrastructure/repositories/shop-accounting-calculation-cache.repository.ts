import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import {
    ShopAccountingCalculationCacheEntry,
    ShopAccountingCalculationCachePort,
} from '@/domains/shop/modules/accounting/application/ports/shop-accounting-calculation-cache.port';
import { CalculationLine } from '@/shared/domain/calculation-line';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// accounting-calculation-cache.repository.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop: та же общая Prisma-таблица accounting_calculation_cache,
// но всегда с фиксированным direction: 'shop'. Не агрегат — таблица-кэш без
// доменных событий и инвариантов, поэтому write(null, ...).
@Injectable()
export class ShopAccountingCalculationCacheRepository
    extends PrismaRepository
    implements ShopAccountingCalculationCachePort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async find(
        period: string,
        employeeId: number,
    ): Promise<ShopAccountingCalculationCacheEntry | null> {
        const record = await this.client.accountingCalculationCache.findUnique({
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
            freshnessStamp: record.freshnessStamp,
            factLines: record.factLines as unknown as CalculationLine[],
            prognoseLines: record.prognoseLines as unknown as CalculationLine[],
            factTotal: record.factTotal,
            prognoseTotal: record.prognoseTotal,
        };
    }

    async upsert(
        period: string,
        employeeId: number,
        entry: ShopAccountingCalculationCacheEntry,
    ): Promise<void> {
        const data = {
            direction: 'shop' as const,
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
                        direction: 'shop',
                        period,
                        employeeId,
                    },
                },
                create: { id: randomUUID(), ...data },
                update: data,
            }),
        );
    }

    async deleteByPeriod(period: string): Promise<void> {
        await this.write(null, (client) =>
            client.accountingCalculationCache.deleteMany({
                where: { direction: 'shop', period },
            }),
        );
    }
}

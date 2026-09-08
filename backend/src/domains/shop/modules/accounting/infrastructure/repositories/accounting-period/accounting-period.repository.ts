import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ShopAccountingPeriodMapper } from '../../mappers/accounting-period/accounting-period.mapper';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// accounting-period.repository.ts (Фаза 5 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop: та же общая Prisma-таблица
// accounting_periods, тот же Prisma-делегат accountingPeriod, но всегда с
// фиксированным direction: 'shop'.
@Injectable()
export class ShopAccountingPeriodRepository
    extends PrismaRepository
    implements ShopAccountingPeriodRepositoryPort
{
    private readonly mapper = new ShopAccountingPeriodMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByPeriod(period: string): Promise<ShopAccountingPeriod | null> {
        const record = await this.client.accountingPeriod.findUnique({
            where: { direction_period: { direction: 'shop', period } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async save(entity: ShopAccountingPeriod): Promise<void> {
        const data = this.mapper.toPersistence(entity);
        await this.write(entity, (client) =>
            client.accountingPeriod.upsert({
                where: { id: data.id },
                create: data,
                update: {
                    status: data.status,
                    closedBy: data.closedBy,
                    closedAt: data.closedAt,
                    updatedAt: data.updatedAt,
                },
            }),
        );
    }
}

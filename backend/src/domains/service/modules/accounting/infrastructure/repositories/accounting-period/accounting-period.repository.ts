import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { AccountingPeriodMapper } from '../../mappers/accounting-period/accounting-period.mapper';

@Injectable()
export class AccountingPeriodRepository
    extends PrismaRepository
    implements AccountingPeriodRepositoryPort
{
    private readonly mapper = new AccountingPeriodMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<AccountingPeriod | null> {
        const record = await this.client.accountingPeriod.findUnique({
            where: { direction_period: { direction, period } },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async save(entity: AccountingPeriod): Promise<void> {
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

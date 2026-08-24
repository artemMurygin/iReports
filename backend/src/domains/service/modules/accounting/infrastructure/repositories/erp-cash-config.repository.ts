import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import { ErpCashConfigRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { ErpCashConfigMapper } from '../mappers/erp-cash-config.mapper';

@Injectable()
export class ErpCashConfigRepository
    extends PrismaRepository
    implements ErpCashConfigRepositoryPort
{
    private readonly mapper = new ErpCashConfigMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByDirection(
        direction: AccountingDirection,
    ): Promise<ErpCashConfig | null> {
        const record = await this.client.erpCashConfig.findUnique({
            where: { direction },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async save(entity: ErpCashConfig): Promise<void> {
        const data = this.mapper.toPersistence(entity);
        await this.write(entity, (client) =>
            client.erpCashConfig.upsert({
                where: { id: data.id },
                create: data,
                update: {
                    roappCashboxId: data.roappCashboxId,
                    moySkladExpenseItemId: data.moySkladExpenseItemId,
                    moySkladIncomeItemId: data.moySkladIncomeItemId,
                    organizationId: data.organizationId,
                    updatedAt: data.updatedAt,
                },
            }),
        );
    }
}

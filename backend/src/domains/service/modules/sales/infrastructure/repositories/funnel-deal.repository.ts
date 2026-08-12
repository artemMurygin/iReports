import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { DealListItemEntity } from '@/domains/service/modules/sales/domain/entities/deal-list-item.entity';
import {
    FunnelDealRepositoryPort,
    ServiceFunnelFilter,
} from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import { SERVICE_FUNNEL_CATEGORY_ID } from '@/domains/service/modules/sales/infrastructure/sales.repositories';
import { DealListItemMapper } from '../mappers/deal-list-item.mapper';

function inFilter<T extends string | number>(
    values: T[],
): { in: T[] } | undefined {
    return values.length > 0 ? { in: values } : undefined;
}

// Реализация FunnelDealRepositoryPort — воспроизводит РОВНО тот же
// Prisma-запрос, что и легаси ReportsService.getServiceFunnelReport
// (src/TODO/reports/reports.service.ts): тот же where (createdAt,
// leadSourceId, assignedById, deviceTypeId, stageId, stage.stageGroupId,
// categoryId), тот же include, тот же orderBy — результаты этого
// read-side'а должны совпадать со старым эндпоинтом
// `GET /reports/service-funnel` на время постепенного переноса. Мапится
// той же DealListItemMapper/DealListItemEntity, что и DealListRepository —
// форма строки идентична (тот же include).
@Injectable()
export class FunnelDealRepository
    extends PrismaRepository
    implements FunnelDealRepositoryPort
{
    private readonly mapper = new DealListItemMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByFilter(
        filter: ServiceFunnelFilter,
    ): Promise<DealListItemEntity[]> {
        const rows = await this.client.bitrixDeal.findMany({
            where: {
                createdAt: {
                    gte: filter.range.getFrom(),
                    lte: filter.range.getTo(),
                },
                leadSourceId: inFilter(filter.sourceIds),
                assignedById: inFilter(filter.managerIds),
                deviceTypeId: inFilter(filter.modelIds),
                stageId: inFilter(filter.stageIds),
                stage: filter.stageGroupIds.length
                    ? { stageGroupId: { in: filter.stageGroupIds } }
                    : undefined,
                categoryId: SERVICE_FUNNEL_CATEGORY_ID,
            },
            include: {
                stage: true,
                assignedBy: true,
                pointOfContact: true,
                leadSource: true,
                brand: true,
                deviceType: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => this.mapper.toDomain(row));
    }
}

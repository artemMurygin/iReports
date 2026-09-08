import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { DealListItemEntity } from '@/domains/service/modules/sales/domain/entities/deal-list-item.entity';
import { DealListRepositoryPort } from '@/domains/service/modules/sales/application/ports/deal-list.port';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { DealListItemMapper } from '../mappers/deal-list-item.mapper';

// Реализация DealListRepositoryPort — воспроизводит РОВНО тот же
// Prisma-запрос, что и легаси DealsService.getDeals
// (src/TODO/deals/deals.service.ts): тот же where по createdAt,
// тот же include, тот же orderBy — результаты этого read-side'а должны
// быть byte-identical со старым эндпоинтом `GET /deals` на время
// постепенного переноса (см. contracts/commands/deal.ts).
@Injectable()
export class DealListRepository
    extends PrismaRepository
    implements DealListRepositoryPort
{
    private readonly mapper = new DealListItemMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByDateRange(range: DateRange): Promise<DealListItemEntity[]> {
        const rows = await this.client.bitrixDeal.findMany({
            where: {
                createdAt: { gte: range.getFrom(), lte: range.getTo() },
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

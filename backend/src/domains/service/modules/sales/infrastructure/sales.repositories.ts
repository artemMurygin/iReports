import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../../../infrustructure/database/database.service';
import { LeadEntity } from '../domain/entities/lead.entity';
import { DealEntity } from '../domain/entities/deal.entity';
import {
  DealRepositoryPort,
  LeadRepositoryPort,
} from '../domain/ports/sales.repositories.port';
import { DealMapper, LeadMapper } from '../sales.mappers';

// Bitrix CATEGORY_ID воронки "Сервис" (см. также CATEGORY_ID: [0, 16, 10, 2]
// в src/integrations/bitrix/bitrix.service.ts, откуда синхронизируются все воронки).
const SERVICE_FUNNEL_CATEGORY_ID = 0;

@Injectable()
export class LeadRepository implements LeadRepositoryPort {
  private readonly leadMapper = new LeadMapper();

  constructor(private readonly db: DatabaseService) {}

  async findModifiedSince(since: Date): Promise<LeadEntity[]> {
    const rows = await this.db.bitrixDeal.findMany({
      where: {
        updatedAt: { gte: since },
        categoryId: SERVICE_FUNNEL_CATEGORY_ID,
      },
      include: {
        stage: true,
        pointOfContact: true,
        leadSource: true,
        brand: true,
        deviceType: true,
      },
    });
    return rows.map((row) => this.leadMapper.toDomain(row));
  }
}

@Injectable()
export class DealRepository implements DealRepositoryPort {
  private readonly dealMapper = new DealMapper();

  constructor(private readonly db: DatabaseService) {}

  async findModifiedSince(since: Date): Promise<DealEntity[]> {
    const rows = await this.db.roappOrder.findMany({
      where: { modifiedAt: { gte: since } },
      include: { status: true, orderType: true, adCampaign: true },
    });
    return rows.map((row) => this.dealMapper.toDomain(row));
  }

  async findDealById(id: number): Promise<DealEntity> {
    const row = await this.db.roappOrder.findUniqueOrThrow({
      where: { id },
      include: { status: true, orderType: true, adCampaign: true },
    });
    return this.dealMapper.toDomain(row);
  }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DealsService {
  constructor(private readonly DB: DatabaseService) {}

  async getDeals(from: Date, to: Date) {
    return this.DB.bitrixDeal.findMany({
      where: {
        createdAt: { gte: from, lte: to },
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
  }

  async getStages() {
    return (
      await this.DB.bitrixStage.findMany({
        where: {
          entityId: 'DEAL_STAGE',
        },
      })
    ).toSorted((a, b) => a.sort - b.sort);
  }

  async getDeviceTypes() {
    const deviceTypes = await this.DB.bitrixDeviceTypes.findMany();
    return deviceTypes;
  }

  async getDealsManagers() {
    const managers = await this.DB.bitrixDeal.findMany({
      select: {
        assignedById: true,
      },
      distinct: ['assignedById'],
      where: {
        assignedById: { not: null },
      },
    });

    return Promise.all(
      managers.map(({ assignedById }) => {
        if (!assignedById) return;
        return this.DB.bitrixEmployee.findFirst({
          where: { id: assignedById },
        });
      }),
    );
  }

  async getDealsSources() {
    return this.DB.bitrixLeadSources.findMany();
  }
}

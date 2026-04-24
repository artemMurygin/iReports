import { Injectable } from '@nestjs/common';
import { getServiceFunnelReportDTO } from './dto/getServiceFunnelReport.dto';
import { DatabaseService } from '../database/database.service';
import { inFilter, serviceFunnelKPICalculation } from './reports.helpers';

@Injectable()
export class ReportsService {
  constructor(private readonly DB: DatabaseService) {}

  async getServiceFunnelReport(filter: getServiceFunnelReportDTO) {
    const { momentFrom, momentTo, sourceIds, managerIds, modelIds, stageIds } =
      filter;

    const deals = await this.DB.bitrixDeal.findMany({
      where: {
        createdAt: { gte: momentFrom, lte: momentTo },
        leadSourceId: inFilter(sourceIds),
        assignedById: inFilter(managerIds),
        deviceTypeId: inFilter(modelIds),
        stageId: inFilter(stageIds),
        categoryId: 0,
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

    return {
      KPI: serviceFunnelKPICalculation(deals),
      deals,
    };
  }
}

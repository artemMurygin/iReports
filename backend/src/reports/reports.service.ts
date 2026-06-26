import { Injectable } from '@nestjs/common';
import { getServiceFunnelReportDTO } from './dto/getServiceFunnelReport.dto';
import { getServicesSoldReportDTO } from './dto/getServicesSoldReport.dto';
import { DatabaseService } from '../database/database.service';
import {
  groupSoldServicesByPeriod,
  inFilter,
  serviceFunnelKPICalculation,
} from './reports.helpers';

@Injectable()
export class ReportsService {
  constructor(private readonly DB: DatabaseService) {}

  async getServiceFunnelReport(filter: getServiceFunnelReportDTO) {
    const { momentFrom, momentTo, sourceIds, managerIds, modelIds, stageIds, stageGroupIds } =
      filter;

    const deals = await this.DB.bitrixDeal.findMany({
      where: {
        createdAt: { gte: momentFrom, lte: momentTo },
        leadSourceId: inFilter(sourceIds),
        assignedById: inFilter(managerIds),
        deviceTypeId: inFilter(modelIds),
        stageId: inFilter(stageIds),
        stage: stageGroupIds.length ? { stageGroupId: { in: stageGroupIds } } : undefined,
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

  async getServicesSoldReport(filter: getServicesSoldReportDTO) {
    const { momentFrom, momentTo, groupBy, categoryIds, serviceIds } = filter;

    const serviceOrders = await this.DB.roappServiceOrder.findMany({
      where: {
        order: { closedAt: { gte: momentFrom, lte: momentTo } },
        serviceId: inFilter(serviceIds),
        service: categoryIds.length
          ? { categoryId: inFilter(categoryIds) }
          : undefined,
      },
      select: {
        quantity: true,
        orderId: true,
        order: { select: { closedAt: true, payed: true, cost: true } },
      },
    });

    const rows = serviceOrders.map((s) => ({
      closedAt: s.order.closedAt!,
      orderId: s.orderId,
      quantity: s.quantity,
      orderPayed: s.order.payed ?? 0,
      orderCost: s.order.cost ?? 0,
    }));

    const breakdown = groupSoldServicesByPeriod(
      rows,
      groupBy,
      momentFrom,
      momentTo,
    );

    const { totalOrdersCount, totalCount, totalRevenue, totalProfit } =
      breakdown.reduce(
        (acc, b) => {
          acc.totalOrdersCount += b.ordersCount;
          acc.totalCount += b.count;
          acc.totalRevenue += b.revenue;
          acc.totalProfit += b.profit;
          return acc;
        },
        { totalOrdersCount: 0, totalCount: 0, totalRevenue: 0, totalProfit: 0 },
      );

    return {
      totalOrdersCount,
      totalCount,
      revenue: totalRevenue,
      profit: totalProfit,
      averageCheck:
        totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0,
      breakdown,
    };
  }
}

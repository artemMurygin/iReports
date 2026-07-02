import { Injectable } from '@nestjs/common';
import { getServiceFunnelReportDTO } from './dto/getServiceFunnelReport.dto';
import { getServicesSoldReportDTO } from './dto/getServicesSoldReport.dto';
import { DatabaseService } from '../database/database.service';
import {
  groupSoldServicesByPeriod,
  getPeriodBucketKey,
  generatePeriodKeys,
  inFilter,
  serviceFunnelKPICalculation,
} from './reports.helpers';

type ServiceOrderRow = {
  closedAt: Date;
  orderId: number;
  quantity: number;
  price: number;
  orderPayed: number;
  orderCost: number;
};

@Injectable()
export class ReportsService {
  constructor(private readonly DB: DatabaseService) {}

  async getServiceFunnelReport(filter: getServiceFunnelReportDTO) {
    const {
      momentFrom,
      momentTo,
      sourceIds,
      managerIds,
      modelIds,
      stageIds,
      stageGroupIds,
    } = filter;

    const deals = await this.DB.bitrixDeal.findMany({
      where: {
        createdAt: { gte: momentFrom, lte: momentTo },
        leadSourceId: inFilter(sourceIds),
        assignedById: inFilter(managerIds),
        deviceTypeId: inFilter(modelIds),
        stageId: inFilter(stageIds),
        stage: stageGroupIds.length
          ? { stageGroupId: { in: stageGroupIds } }
          : undefined,
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

  async getServiceCategories() {
    return this.DB.roappServiceCategory.findMany({
      select: { id: true, name: true, parentId: true, depth: true },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    });
  }

  async getServicesAnalytics(filter: getServicesSoldReportDTO) {
    const { momentFrom, momentTo, groupBy } = filter;

    const serviceOrders = await this.getServiceOrders(filter);
    const serviceMap = this.buildServiceMap(serviceOrders);
    const periods = generatePeriodKeys(momentFrom, momentTo, groupBy);

    const services = [...serviceMap.entries()].map(
      ([
        serviceId,
        { name, categoryId, engeneerBonus, priceListPrice, rows },
      ]) => ({
        serviceId,
        engeneerBonus,
        priceListPrice,
        // engeneerSalary: rows.engeneerSalary,
        serviceName: name,
        categoryId,
        ...this.calcServiceMetrics(rows),
        breakdown: this.buildPeriodBreakdown(rows, periods, groupBy),
      }),
    );

    return { services };
  }

  private async getServiceOrders(filter: getServicesSoldReportDTO) {
    const { momentFrom, momentTo, categoryIds, serviceIds } = filter;
    return this.DB.roappServiceOrder.findMany({
      where: {
        order: {
          closedAt: { gte: momentFrom, lte: momentTo },
          orderTypeId: 17199,
        },
        serviceId: inFilter(serviceIds),
        service: categoryIds.length
          ? { categoryId: inFilter(categoryIds) }
          : undefined,
      },
      select: {
        serviceId: true,
        orderId: true,
        quantity: true,
        price: true,
        service: {
          select: {
            name: true,
            categoryId: true,
            engeneerBonus: true,
            price: true,
          },
        },
        order: { select: { closedAt: true, payed: true, cost: true } },
      },
    });
  }

  private buildServiceMap(
    serviceOrders: Awaited<ReturnType<ReportsService['getServiceOrders']>>,
  ) {
    const serviceMap = new Map<
      number,
      {
        name: string;
        categoryId: number | null;
        engeneerBonus: number;
        priceListPrice: number;
        rows: ServiceOrderRow[];
      }
    >();

    for (const row of serviceOrders) {
      const entry = serviceMap.get(row.serviceId) ?? {
        name: row.service.name,
        categoryId: row.service.categoryId,
        engeneerBonus: row.service.engeneerBonus,
        priceListPrice: row.service.price,
        rows: [] as ServiceOrderRow[],
      };
      entry.rows.push({
        closedAt: row.order.closedAt!,
        orderId: row.orderId,
        quantity: row.quantity,
        price: row.price,
        orderPayed: row.order.payed ?? 0,
        orderCost: row.order.cost ?? 0,
      });
      serviceMap.set(row.serviceId, entry);
    }

    return serviceMap;
  }

  private buildPeriodBreakdown(
    rows: ServiceOrderRow[],
    periods: string[],
    groupBy: getServicesSoldReportDTO['groupBy'],
  ) {
    const buckets = new Map<
      string,
      { count: number; priceWeightedSum: number }
    >();

    for (const row of rows) {
      const key = getPeriodBucketKey(row.closedAt, groupBy);
      const bucket = buckets.get(key) ?? { count: 0, priceWeightedSum: 0 };
      bucket.count += row.quantity;
      bucket.priceWeightedSum += row.price * row.quantity;
      buckets.set(key, bucket);
    }

    return periods.map((period) => {
      const b = buckets.get(period);
      return {
        period,
        count: b?.count ?? 0,
        avgPrice:
          b && b.count > 0 ? Math.round(b.priceWeightedSum / b.count) : 0,
      };
    });
  }

  private calcServiceMetrics(rows: ServiceOrderRow[]) {
    const totalCount = rows.reduce((s, r) => s + r.quantity, 0);
    const priceWeightedSum = rows.reduce((s, r) => s + r.price * r.quantity, 0);
    const avgServicePrice =
      totalCount > 0 ? Math.round(priceWeightedSum / totalCount) : 0;

    const uniqueOrders = new Map<number, { payed: number; cost: number }>();
    for (const row of rows) {
      if (!uniqueOrders.has(row.orderId)) {
        uniqueOrders.set(row.orderId, {
          payed: row.orderPayed,
          cost: row.orderCost,
        });
      }
    }
    const orderValues = [...uniqueOrders.values()];
    const totalRevenue = orderValues.reduce((s, o) => s + o.payed, 0);
    const totalProfit = orderValues.reduce((s, o) => s + o.payed - o.cost, 0);
    const avgOrderCheck =
      orderValues.length > 0
        ? Math.round(totalRevenue / orderValues.length)
        : 0;

    return {
      totalCount,
      totalRevenue,
      totalProfit,
      avgServicePrice,
      avgOrderCheck,
    };
  }
}

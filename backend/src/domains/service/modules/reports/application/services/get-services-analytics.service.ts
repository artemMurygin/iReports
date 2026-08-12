import { Inject, Injectable } from '@nestjs/common';
import type { GetServicesAnalyticsResponse } from 'ireports-contracts';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { SERVICE_SALES_SOURCE } from '../ports/service-sales.port';
import type { ServiceSalesSourcePort } from '../ports/service-sales.port';
import { ServiceSaleEntity } from '../../domain/entities/service-sale.entity';
import {
    PeriodBucket,
    PeriodGranularity,
} from '../../domain/value-objects/period-bucket.value-object';
import { calculateServiceMetrics } from '../../domain/services/service-metrics.calculator';
import { buildPeriodBreakdown } from '../../domain/services/period-breakdown.calculator';
import { toServiceAnalyticsItemResponse } from '../mappers/to-service-analytics-item-response';

export interface GetServicesAnalyticsFilter {
    range: DateRange;
    groupBy: PeriodGranularity;
    categoryIds: number[];
    serviceIds: number[];
}

// Read-side аналитики проданных услуг (GET /v1/service/reports/services) —
// перенос ReportsService.getServicesAnalytics (src/TODO/reports/
// reports.service.ts): один запрос строк "услуга × заказ" через порт,
// группировка по serviceId — та же последовательность (порядок обхода Map
// = порядок строк из findMany, без явного orderBy), что и buildServiceMap в
// легаси, воспроизведена репозиторием (см. ServiceSalesRepository).
@Injectable()
export class GetServicesAnalyticsService {
    constructor(
        @Inject(SERVICE_SALES_SOURCE)
        private readonly source: ServiceSalesSourcePort,
    ) {}

    async execute(
        filter: GetServicesAnalyticsFilter,
    ): Promise<GetServicesAnalyticsResponse> {
        const rows = await this.source.findByFilter({
            range: filter.range,
            categoryIds: filter.categoryIds,
            serviceIds: filter.serviceIds,
        });

        const bucket = PeriodBucket.create(filter.groupBy);
        const periods = bucket.generateKeys(
            filter.range.getFrom(),
            filter.range.getTo(),
        );

        const rowsByService = new Map<number, ServiceSaleEntity[]>();
        for (const row of rows) {
            const { serviceId } = row.getProps();
            const group = rowsByService.get(serviceId) ?? [];
            group.push(row);
            rowsByService.set(serviceId, group);
        }

        const services = [...rowsByService.entries()].map(
            ([serviceId, serviceRows]) => {
                const { serviceName, categoryId } = serviceRows[0].getProps();
                const metrics = calculateServiceMetrics(serviceRows);
                const breakdown = buildPeriodBreakdown(
                    serviceRows,
                    periods,
                    bucket,
                );
                return toServiceAnalyticsItemResponse(
                    serviceId,
                    serviceName,
                    categoryId,
                    metrics,
                    breakdown,
                );
            },
        );

        return { services };
    }
}

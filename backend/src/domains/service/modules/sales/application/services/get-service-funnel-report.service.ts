import { Inject, Injectable } from '@nestjs/common';
import type { GetServiceFunnelReportResponse } from 'ireports-contracts';
import { FUNNEL_DEAL_REPOSITORY } from '../ports/funnel-deal.port';
import type {
    FunnelDealRepositoryPort,
    ServiceFunnelFilter,
} from '../ports/funnel-deal.port';
import { FunnelStageMap } from '../../domain/value-objects/funnel-stage-map.value-object';
import { calculateServiceFunnelKpi } from '../../domain/services/funnel-kpi.calculator';
import { toDealListItemResponse } from '../mappers/to-deal-list-item-response';
import { toServiceFunnelKpiResponse } from '../mappers/to-service-funnel-kpi-response';

// Read-side отчёта по воронке (GET /v1/service/sales/funnel-report) —
// перенос ReportsService.getServiceFunnelReport (src/TODO/reports/
// reports.service.ts): один запрос за сделками через порт, KPI считается
// доменным калькулятором на той же выборке, что отдаётся в `deals` —
// ровно то же двойное использование, что у легаси (`{ KPI: ..., deals }`
// из одного и того же массива `deals`).
@Injectable()
export class GetServiceFunnelReportService {
    constructor(
        @Inject(FUNNEL_DEAL_REPOSITORY)
        private readonly funnelDealRepository: FunnelDealRepositoryPort,
    ) {}

    async execute(
        filter: ServiceFunnelFilter,
    ): Promise<GetServiceFunnelReportResponse> {
        const deals = await this.funnelDealRepository.findByFilter(filter);
        const stageMap = FunnelStageMap.default();

        const kpi = calculateServiceFunnelKpi(
            deals.map((deal) => {
                const props = deal.getProps();
                return {
                    stageId: props.stage?.getId() ?? null,
                    opportunity: props.opportunity,
                };
            }),
            stageMap,
        );

        return {
            KPI: toServiceFunnelKpiResponse(kpi),
            deals: deals.map(toDealListItemResponse),
        };
    }
}

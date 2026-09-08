import { ValueObject } from '@/shared/domain/value-object.base';

// Результат расчёта воронки сервисных сделок — форма 1:1 с возвратом
// легаси serviceFunnelKPICalculation (src/TODO/reports/reports.helpers.ts).
// Считается доменным сервисом funnel-kpi.calculator.ts, не самим VO (в
// отличие от SalesFact.calculate) — по заданию Фазы 4 расчёт вынесен в
// отдельный calculator-файл, а не в статический метод VO.
export interface ServiceFunnelKpiProps {
    allLeads: number;
    nonTargetDeals: number;
    targetedLeads: number;
    won: number;
    lose: number;
    inWork: number;
    waitingInService: number;
    inService: number;
    conversionRate: number;
    avgDeal: number;
    revenue: number;
}

export class ServiceFunnelKpi extends ValueObject<ServiceFunnelKpiProps> {
    static create(props: ServiceFunnelKpiProps): ServiceFunnelKpi {
        return new ServiceFunnelKpi(props);
    }

    getAllLeads(): number {
        return this.props.allLeads;
    }

    getNonTargetDeals(): number {
        return this.props.nonTargetDeals;
    }

    getTargetedLeads(): number {
        return this.props.targetedLeads;
    }

    getWon(): number {
        return this.props.won;
    }

    getLose(): number {
        return this.props.lose;
    }

    getInWork(): number {
        return this.props.inWork;
    }

    getWaitingInService(): number {
        return this.props.waitingInService;
    }

    getInService(): number {
        return this.props.inService;
    }

    getConversionRate(): number {
        return this.props.conversionRate;
    }

    getAvgDeal(): number {
        return this.props.avgDeal;
    }

    getRevenue(): number {
        return this.props.revenue;
    }
}

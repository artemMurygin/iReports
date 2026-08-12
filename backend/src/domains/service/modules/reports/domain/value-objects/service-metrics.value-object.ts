import { ValueObject } from '@/shared/domain/value-object.base';

// Агрегированные метрики одной услуги за период — форма 1:1 с возвратом
// легаси calcServiceMetrics (src/TODO/reports/reports.service.ts). Считается
// доменным сервисом service-metrics.calculator.ts, не самим VO — тот же
// приём, что и у ServiceFunnelKpi/funnel-kpi.calculator.ts в modules/sales.
export interface ServiceMetricsProps {
    totalCount: number;
    totalRevenue: number;
    totalProfit: number;
    totalEngineerBonus: number;
    avgServicePrice: number;
    avgOrderCheck: number;
}

export class ServiceMetrics extends ValueObject<ServiceMetricsProps> {
    static create(props: ServiceMetricsProps): ServiceMetrics {
        return new ServiceMetrics(props);
    }

    getTotalCount(): number {
        return this.props.totalCount;
    }

    getTotalRevenue(): number {
        return this.props.totalRevenue;
    }

    getTotalProfit(): number {
        return this.props.totalProfit;
    }

    getTotalEngineerBonus(): number {
        return this.props.totalEngineerBonus;
    }

    getAvgServicePrice(): number {
        return this.props.avgServicePrice;
    }

    getAvgOrderCheck(): number {
        return this.props.avgOrderCheck;
    }
}

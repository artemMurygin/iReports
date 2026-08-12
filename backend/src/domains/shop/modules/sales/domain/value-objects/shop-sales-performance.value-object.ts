import { ValueObject } from '@/shared/domain/value-object.base';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { SalesPrognose } from '@/shared/domain/sales-prognose.value-object';
import { ShopSalesFact } from './shop-sales-fact.value-object';

export interface ShopSalesPerformanceProps {
    plan: SalesPlan;
    fact: ShopSalesFact;
    prognose: SalesPrognose;
}

// Агрегат "план + факт + прогноз" на одну строку (department, category,
// period) для направления shop — зеркало SalesPerformance направления
// service (Фаза 5), но с ShopSalesFact вместо SalesFact.
//
// SalesPlan (`plan`) — тот же класс, что использует направление service, а
// не его копия: SalesPlan/SalesPlanTemplate и их CRUD (domains/service/
// modules/sales) уже общие для обоих направлений на уровне Prisma-модели
// (`direction` на каждой строке, см. sales.prisma) и не содержат ничего
// ERP-специфичного — единственное намеренное исключение из правила "shop и
// service не переиспользуют код" в этой фазе (см. docs/payroll/
// plan-payroll-calculation.md, Фаза 11, и обоснование в отчёте фазы).
// ShopSalesFact и весь ERP-специфичный код (MoySkladDemand) остаются
// самостоятельными для shop.
export class ShopSalesPerformance extends ValueObject<ShopSalesPerformanceProps> {
    static create(
        plan: SalesPlan,
        fact: ShopSalesFact,
        prognose: SalesPrognose,
    ): ShopSalesPerformance {
        return new ShopSalesPerformance({ plan, fact, prognose });
    }

    getPeriod(): string {
        return this.props.plan.period;
    }

    getDepartment(): number {
        return this.props.plan.department;
    }

    getCategory(): string | null {
        return this.props.plan.category;
    }

    getPlan(): SalesPlan {
        return this.props.plan;
    }

    getFact(): ShopSalesFact {
        return this.props.fact;
    }

    getPrognose(): SalesPrognose {
        return this.props.prognose;
    }
}

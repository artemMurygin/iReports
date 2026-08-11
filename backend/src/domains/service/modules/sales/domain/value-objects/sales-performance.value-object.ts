import { ValueObject } from '@/shared/domain/value-object.base';
import { SalesPlan } from '../entities/sales-plan.entity';
import { SalesFact } from './sales-fact.value-object';
import { SalesPrognose } from '@/shared/domain/sales-prognose.value-object';
import type { SalesDirection } from '../types/sales-plan.types';

export interface SalesPerformanceProps {
    plan: SalesPlan;
    fact: SalesFact;
    prognose: SalesPrognose;
}

// Агрегат "план + факт + прогноз" на одну строку (direction, department,
// category, period) — вход для страницы выполнения плана и, через порт
// SalesPerformanceReaderPort, для зарплатных правил с процентом от
// выполнения плана (Фаза 5, docs/payroll/plan-payroll-calculation.md).
// Не персистентная сущность: план читается из БД как есть, факт и прогноз
// считаются заново на каждый запрос (кэширование результата целиком —
// Фаза 6), поэтому у самого агрегата нет собственного id — direction/
// department/category/period берутся из уже провалидированного плана.
export class SalesPerformance extends ValueObject<SalesPerformanceProps> {
    static create(
        plan: SalesPlan,
        fact: SalesFact,
        prognose: SalesPrognose,
    ): SalesPerformance {
        return new SalesPerformance({ plan, fact, prognose });
    }

    getDirection(): SalesDirection {
        return this.props.plan.direction;
    }

    getPeriod(): string {
        return this.props.plan.period;
    }

    getDepartment(): number {
        return this.props.plan.department;
    }

    getCategory(): number | null {
        return this.props.plan.category;
    }

    getPlan(): SalesPlan {
        return this.props.plan;
    }

    getFact(): SalesFact {
        return this.props.fact;
    }

    getPrognose(): SalesPrognose {
        return this.props.prognose;
    }
}

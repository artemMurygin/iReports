import { ValueObject } from '@/shared/domain/value-object.base';

// Тип заказа RoappOrderType (roapp.prisma, roapp_order_types) — плоская
// проекция для GET /v1/service/reports/order-type (Фаза 1, docs/
// service-plan-salary-rule-order-category-filter/plan-service-plan-salary-
// rule-order-category-filter.md), "категория заказа" в терминах этой фичи.
// Отдельный от domains/service/modules/sales/domain/value-objects/
// order-type.value-object.ts — тот VO обслуживает Deal entity в другом
// модуле (иная область применения), этот — локальный для reports.
export interface OrderTypeProps {
    id: number;
    name: string;
}

export class OrderType extends ValueObject<OrderTypeProps> {
    static create(props: OrderTypeProps): OrderType {
        return new OrderType(props);
    }

    getId(): number {
        return this.props.id;
    }

    getName(): string {
        return this.props.name;
    }
}

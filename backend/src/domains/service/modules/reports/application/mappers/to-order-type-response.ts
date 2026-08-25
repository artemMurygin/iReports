import type { OrderTypeResponse } from 'ireports-contracts';
import { OrderType } from '../../domain/value-objects/order-type.value-object';

// VO → плоская форма контракта, по образцу to-service-category-response.ts —
// читает значения через геттеры VO, ничего не вычисляет.
export function toOrderTypeResponse(orderType: OrderType): OrderTypeResponse {
    return {
        id: orderType.getId(),
        name: orderType.getName(),
    };
}

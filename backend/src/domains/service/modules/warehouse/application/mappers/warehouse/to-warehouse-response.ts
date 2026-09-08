import type { WarehouseResponse } from 'ireports-contracts';
import { Warehouse } from '@/domains/service/modules/warehouse/domain/value-objects/warehouse.value-object';

export function toWarehouseResponse(warehouse: Warehouse): WarehouseResponse {
    return {
        id: warehouse.getId(),
        name: warehouse.getName(),
    };
}

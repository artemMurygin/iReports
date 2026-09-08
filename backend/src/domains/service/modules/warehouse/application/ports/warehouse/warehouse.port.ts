import { Warehouse } from '@/domains/service/modules/warehouse/domain/value-objects/warehouse.value-object';

// Read-порт над новой RoappWarehouse (резервный справочник ROAPP_WAREHOUSES,
// см. design.md D3) — без бизнес-инвариантов, никаких write-методов
// (справочник наполняется синком RoApp, не этим модулем).
export interface WarehouseRepositoryPort {
    findAll(): Promise<Warehouse[]>;
}

export const WAREHOUSE_REPOSITORY = Symbol('WAREHOUSE_REPOSITORY');

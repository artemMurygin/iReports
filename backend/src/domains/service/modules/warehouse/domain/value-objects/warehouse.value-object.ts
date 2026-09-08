import { ValueObject } from '@/shared/domain/value-object.base';

// Склад RoappWarehouse (roapp.prisma) — плоская проекция для справочника
// GET /v1/service/warehouse/warehouses и для перебора складов в
// BuildGoodsTurnoverReportService (задача 9). Источник данных — резервный
// ручной справочник ROAPP_WAREHOUSES, синкающийся в roapp_warehouses разовой
// командой npm run initial (см. design.md D3, integrations/roapp/
// roapp-warehouses.config.ts) — не публичное REST API RemOnline напрямую.
export interface WarehouseProps {
    id: number;
    name: string;
}

export class Warehouse extends ValueObject<WarehouseProps> {
    static create(props: WarehouseProps): Warehouse {
        return new Warehouse(props);
    }

    getId(): number {
        return this.props.id;
    }

    getName(): string {
        return this.props.name;
    }
}

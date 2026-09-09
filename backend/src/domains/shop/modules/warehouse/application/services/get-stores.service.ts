import { Injectable } from '@nestjs/common';
import type { ShopStore } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';

// Справочный список складов МойСклад (GET /v1/shop/warehouse/stores,
// design.md D10) — для фильтра склада на странице отчёта по
// оборачиваемости. MoySkladStore не моделируется как доменная сущность
// (architecture.md: синхронизированный справочник без бизнес-инвариантов),
// поэтому это простой read-only запрос, по образцу GetCatalogService.
@Injectable()
export class GetShopStoresService {
    constructor(private readonly db: DatabaseService) {}

    async list(): Promise<ShopStore[]> {
        return this.db.moySkladStore.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
    }
}

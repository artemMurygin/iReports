import { Module } from '@nestjs/common';
import { GetCatalogService } from './application/services/get-catalog.service';
import { GetCatalogHttpController } from './interface/http-controllers/get-catalog.http.controller';

// Модуль warehouse (Фаза 1, см.
// docs/shop-warehouse-catalog/plan-shop-warehouse-catalog.md) — пока одна
// сущность catalog: дерево категорий MoySkladProductFolder, без товаров/
// остатков по физическим складам (см. PRD, "Не в скоупе"; целевой набор
// модулей домена — src/domains/shop/CLAUDE.md). DatabaseService доступен
// глобально (DatabaseModule помечен @Global()), явный импорт не нужен.
@Module({
    controllers: [GetCatalogHttpController],
    providers: [GetCatalogService],
})
export class ShopWarehouseModule {}

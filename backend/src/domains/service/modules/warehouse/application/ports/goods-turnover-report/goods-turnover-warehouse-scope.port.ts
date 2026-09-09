// Токен DI для GoodsTurnoverWarehouseScope (domain/value-objects) — конфиг
// того, до какой глубины дерева категорий строится отчёт для основного
// склада и для всех остальных (см. warehouse.module.ts: `useValue:
// GoodsTurnoverWarehouseScope.default()`). Интерфейса порта нет — инжектится
// сам value object, это не абстракция над внешней системой.
export const GOODS_TURNOVER_WAREHOUSE_SCOPE = Symbol(
    'GOODS_TURNOVER_WAREHOUSE_SCOPE',
);

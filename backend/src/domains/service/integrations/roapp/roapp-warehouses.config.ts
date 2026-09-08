import { WarehousesSchema } from './schemas/warehouses.schema';

// РЕЗЕРВНЫЙ ИСТОЧНИК справочника складов (задача 1.1/4.3 change
// service-turnover-report, design.md D3 + раздел «Риски» — допущение о
// наличии в публичном REST API RemOnline ресурса списка складов не
// подтвердилось).
//
// Проверено на этапе реализации (задача 4.3):
// — Официальный OpenAPI-индекс RemOnline (RoApp MCP `search-endpoints`) не
//   находит ни одного эндпоинта по паттернам `warehouse`/`stock`/`storage`.
// — Прямой вызов живого API (`GET /v2/...` с валидным ROAPP_TOKEN) — все
//   правдоподобные пути (`/warehouses`, `/company/warehouses`,
//   `/storage/warehouses`, `/catalog/warehouses`, `/warehouse`,
//   `/stock/warehouses`) отвечают 404; `/company/locations` существует, но
//   отдаёт точки обслуживания (филиалы), а не склады товара — в данных
//   компании ровно одна запись при известных нескольких складах.
// — `warehouseId` встречается только внутри `write_offs` позиций заказа
//   (`GET /v2/orders/{id}/items`, см. `schemas/orderItems.schema.ts`) — это
//   только числовой ID списания без названия склада, недостаточно для
//   заполнения `RoappWarehouse.name`, и сам список позиций заказа сейчас не
//   персистит `write_offs` — восстановить оттуда справочник без отдельной
//   миграции/рефакторинга синка заказов нельзя (вне скоупа задачи 4).
// — Кастомный бэкенд-компаньон `rm.murygin.tech` (design.md, «Предпочтительно»
//   в warehouse-api-finding.md — вспомогательный эндпоинт мог бы там быть)
//   полностью недоступен на момент реализации: `502 Bad Gateway` на любой
//   путь, включая корень `/` — не специфика `getGoodsFlowReport`, см.
//   `warehouse-api-finding.md`. Проверить наличие там вспомогательного
//   ресурса не удалось.
//
// Итоговый резервный источник — ручной справочник, заданный переменной
// окружения `ROAPP_WAREHOUSES` (JSON-массив `{id, name}`) — вариант, прямо
// допущенный design.md («Риски»): «ручной справочник (админится вручную,
// обновляется редко)». Читается один раз за вызов из `process.env`, без
// перезапуска процесса изменение не подхватится — та же модель, что уже
// используется для `ROAPP_CASHBOX_ID`/`ROAPP_CATEGORY_ID`
// (`modules/accounting/infrastructure/repositories/erp-cash/erp-cash.config.ts`).
// Пустой/неустановленный `ROAPP_WAREHOUSES` — валидное состояние (справочник
// ещё не заполнен админом), возвращает пустой список, а не ошибку.
export function readManualWarehouses(): { id: number; name: string }[] {
    const raw = process.env.ROAPP_WAREHOUSES;
    if (!raw) return [];

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error(
            'ROAPP_WAREHOUSES должен быть валидным JSON-массивом вида ' +
                '[{"id": 1, "name": "Склад 1"}]',
        );
    }

    return WarehousesSchema.parse(parsed);
}

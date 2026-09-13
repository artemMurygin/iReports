import { z } from 'zod';

// Контракты для GET /v1/service/warehouse/goods-turnover-report/:period,
// GET /v1/service/warehouse/product-categories и
// GET /v1/service/warehouse/warehouses — новый модуль
// domains/service/modules/warehouse
// (openspec/changes/service-turnover-report, задача 10). Справочники — тот
// же плоский паттерн, что serviceCategorySchema/orderTypeSchema в report.ts:
// иерархия категорий восстанавливается вызывающей стороной по parentId.

// ==================== Справочник категорий товаров ==================== //

// RoappProductCategory (roapp.prisma) — плоская проекция, без depth (та
// таблица её не хранит, в отличие от RoappServiceCategory/
// serviceCategorySchema в report.ts).
const productCategorySchema = z.object({
    id: z.number(),
    name: z.string(),
    parentId: z.number().nullable(),
});
export type ProductCategoryResponse = z.infer<typeof productCategorySchema>;

const listProductCategoriesResponseSchema = z.array(productCategorySchema);
export type ListProductCategoriesResponse = z.infer<
    typeof listProductCategoriesResponseSchema
>;

// ==================== Справочник складов ==================== //

// RoappWarehouse (roapp.prisma) — резервный справочник ROAPP_WAREHOUSES
// (design.md D3 change service-turnover-report), не публичное REST API
// RemOnline напрямую.
const warehouseSchema = z.object({
    id: z.number(),
    name: z.string(),
});
export type WarehouseResponse = z.infer<typeof warehouseSchema>;

const listWarehousesResponseSchema = z.array(warehouseSchema);
export type ListWarehousesResponse = z.infer<
    typeof listWarehousesResponseSchema
>;

// ==================== Отчёт по оборачиваемости товаров ==================== //

// Одна позиция отчёта — категория × склад за календарный месяц
// (specs/service/goods-turnover/spec.md, "Позиция отчёта содержит расход и
// остаток в штуках и в рублях" + "...коэффициент оборачиваемости").
// Денормализована именем/parentId категории и именем склада прямо в строке
// (GetGoodsTurnoverReportService на бэкенде) — GoodsTurnoverTable
// (ui-design.md, задача 18) строит дерево строк из плоского списка без
// отдельного join со справочником категорий на фронтенде; справочники выше
// используются отдельно для фильтров/селектов (CategoryTreeSelect/
// WarehouseSelect, задачи 16-17), а не для сборки этой таблицы.
const goodsTurnoverReportLineSchema = z.object({
    categoryId: z.number(),
    categoryName: z.string(),
    categoryParentId: z.number().nullable(),
    warehouseId: z.number(),
    warehouseName: z.string(),
    outcomeQuantity: z.number(),
    outcomeSum: z.number(),
    stockQuantity: z.number(),
    stockSum: z.number(),
    // null — коэффициент не рассчитан (нет сохранённых данных за прошлый
    // месяц по этой же паре категория-склад, либо средний остаток равен
    // нулю), не 0 — спек, сценарии "Нет сохранённых данных за прошлый
    // месяц"/"Средний остаток равен нулю".
    turnoverRatio: z.number().nullable(),
});
export type GoodsTurnoverReportLineResponse = z.infer<
    typeof goodsTurnoverReportLineSchema
>;

// Итоговая строка «по складу» (add-department-head-salary-rules, FR5) — сумма, количество и
// коэффициент по всем НАСТОЯЩИМ корневым категориям склада (categoryParentId === null), по одной
// записи на склад. Формула переезжает на backend с frontend (`summarizeGoodsTurnoverRows` —
// pages/GoodsTurnoverReport/model/goodsTurnoverTree.ts), чтобы: (a) её мог переиспользовать
// зарплатный расчёт правила DepartmentTurnoverBonus при category = null («весь склад», design.md
// Decision 6); (b) frontend отчёта не дублировал и не мог разойтись с зарплатным расчётом в формуле.
// warehouseId — обязателен: без него не отличить итог одного склада от другого в массиве totals.
// turnoverRatio — средневзвешенный по остатку коэффициент (Σ ratio_i·stock_i / Σ stock_i, только
// строки с посчитанным коэффициентом); null — ни одна корневая строка склада не имеет посчитанного
// коэффициента (та же семантика null, что и у goodsTurnoverReportLineSchema.turnoverRatio выше).
const goodsTurnoverWarehouseTotalSchema = z.object({
    warehouseId: z.number(),
    outcomeSum: z.number(),
    stockSum: z.number(),
    stockQuantity: z.number(),
    turnoverRatio: z.number().nullable(),
});
export type GoodsTurnoverWarehouseTotalResponse = z.infer<
    typeof goodsTurnoverWarehouseTotalSchema
>;

const getGoodsTurnoverReportResponseSchema = z.object({
    period: z.string(),
    // Пустой список строк — валидный ответ (месяц ещё ни разу не
    // пересчитан), не ошибка — фронтенд показывает состояние «отчёт ещё не
    // пересчитан» (ui-design.md, «Ключевые состояния»), а не карточку ошибки.
    lines: z.array(goodsTurnoverReportLineSchema),
    // totals (add-department-head-salary-rules, FR5) — аддитивное поле поверх уже существующего
    // {period, lines}: пустой массив вместе с пустым lines у ещё не пересчитанного периода, иначе
    // по одной записи на каждый склад, встретившийся в lines.
    totals: z.array(goodsTurnoverWarehouseTotalSchema),
});
export type GetGoodsTurnoverReportResponse = z.infer<
    typeof getGoodsTurnoverReportResponseSchema
>;

export {
    productCategorySchema,
    listProductCategoriesResponseSchema,
    warehouseSchema,
    listWarehousesResponseSchema,
    goodsTurnoverReportLineSchema,
    goodsTurnoverWarehouseTotalSchema,
    getGoodsTurnoverReportResponseSchema,
};

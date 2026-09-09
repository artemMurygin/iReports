import { z } from 'zod';

// spec: service/goods-turnover — задача 4 change service-turnover-report.
// Форма записи склада: только id + name, ровно то, что нужно
// RoappWarehouse (prisma/schema/roapp.prisma) — по образцу справочников
// категорий/сотрудников. Это целевая, уже нормализованная форма — сырой
// ответ RemOnline (см. RoappWarehousesApiResponseSchema ниже) маппится в
// неё в RoappService.fetchWarehouses().
export const WarehouseSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
});

export const WarehousesSchema = z.array(WarehouseSchema);

// Сырой ответ `GET https://api.roapp.io/warehouse/` — эндпоинт из более
// старой (v1.4) версии публичного API RemOnline, не описанной в актуальном
// OpenAPI-индексе (`api.roapp.io/v2`, откуда и взялось ошибочное допущение
// design.md D3 об отсутствии ресурса складов вовсе), но рабочей и
// принимающей тот же Bearer ROAPP_TOKEN — см. документацию
// https://roapp.readme.io/v1.4/reference/get-warehouses и комментарий над
// RoappService.fetchWarehouses().
export const RoappWarehouseApiItemSchema = z.object({
    id: z.number().int().positive(),
    title: z.string().min(1),
    is_global: z.boolean(),
    type: z.string(),
});

export const RoappWarehousesApiResponseSchema = z.object({
    data: z.array(RoappWarehouseApiItemSchema),
    count: z.number().int().nonnegative(),
    success: z.boolean(),
});

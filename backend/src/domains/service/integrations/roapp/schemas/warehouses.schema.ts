import { z } from 'zod';

// spec: service/goods-turnover — задача 4 change service-turnover-report.
// Форма записи склада: только id + name, ровно то, что нужно
// RoappWarehouse (prisma/schema/roapp.prisma) — по образцу справочников
// категорий/сотрудников (WarehousesSchema.parse() валидирует и резервный
// источник, см. roapp-warehouses.config.ts, а не только гипотетический
// ответ публичного API).
export const WarehouseSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
});

export const WarehousesSchema = z.array(WarehouseSchema);

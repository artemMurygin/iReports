import { z } from 'zod';

// Импорт закупочных цен магазина из прайса поставщика (XLSX) — контракт для
// будущего `POST /v1/shop/marketing/pricing/import-costs` (Фаза 10,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md),
// нового дома `POST /price-monitoring/update-shop-products-costs`
// (см. src/TODO/priceMonitoring/dto/updateShopProductsCosts.dto.ts). Форма
// запроса скопирована с легаси-DTO без изменений — файл передаётся как
// base64-строка внутри JSON, формат не меняется (см. Фаза 9 плана).

const startPriceImportRequestSchema = z.object({
    file: z
        .string()
        .min(1, 'File is required')
        .refine(
            (val) => /^[A-Za-z0-9+/]*={0,2}$/.test(val),
            'File must be a valid base64 string',
        ),
});
export type StartPriceImportRequest = z.infer<
    typeof startPriceImportRequestSchema
>;

// Ответ будущего эндпоинта — джоба запускается fire-and-forget, наружу сразу
// отдаётся только её id (см. легаси-контроллер: `{ id }` из
// `crypto.randomUUID()`); статус/прогресс — отдельные HTTP/SSE-запросы
// (Фаза 10).
const startPriceImportResponseSchema = z.object({
    id: z.string(),
});
export type StartPriceImportResponse = z.infer<
    typeof startPriceImportResponseSchema
>;

export { startPriceImportRequestSchema, startPriceImportResponseSchema };

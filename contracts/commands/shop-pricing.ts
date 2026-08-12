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

// Статус/прогресс джобы импорта (Фаза 10) — общая форма для `GET
// .../import-costs/:id/status` (снапшот по запросу) и данных, которыми
// наполняется каждое SSE-сообщение `GET .../import-costs/:id` (см.
// PriceImportJob/JobProgress в domains/shop/modules/marketing/pricing/domain,
// Фаза 8). `progress` — `null`, пока джоба ещё не перешла в `RUNNING`
// (снапшот сразу после `POST .../import-costs`); `percent` внутри —
// `null`, пока `total` для текущего этапа ещё неизвестен (см.
// JobProgress.getPercent()).
const jobProgressSchema = z.object({
    stage: z.string(),
    processed: z.number(),
    total: z.number(),
    message: z.string(),
    percent: z.number().nullable(),
});
export type JobProgress = z.infer<typeof jobProgressSchema>;

const priceImportJobStatusResponseSchema = z.object({
    id: z.string(),
    status: z.enum(['CREATED', 'RUNNING', 'COMPLETED', 'FAILED']),
    progress: jobProgressSchema.nullable(),
    errorMessage: z.string().nullable(),
});
export type PriceImportJobStatusResponse = z.infer<
    typeof priceImportJobStatusResponseSchema
>;

export {
    startPriceImportRequestSchema,
    startPriceImportResponseSchema,
    jobProgressSchema,
    priceImportJobStatusResponseSchema,
};

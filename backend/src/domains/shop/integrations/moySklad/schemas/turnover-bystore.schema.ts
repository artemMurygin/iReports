import { z } from 'zod';

// GET /report/turnover/bystore?filter=product=<href>&momentFrom=...&momentTo=...&
// withoutTurnover=true (design.md D1, шаг 2, fix-shop-turnover-historical-stock-cost) — строка
// отчёта "Обороты" на ОДИН товар/модификацию (один вызов = один товар, см. proposal.md "What
// Changes"), с разбивкой остатка на конец периода по складам в `stockByStore[]`.
// `assortment.meta.href`/`type` — та же ссылка на товар, что передавалась в фильтр запроса
// (используется вызывающим кодом для сверки account-wide и по-складской суммы, design.md D4).
// Каждая запись `stockByStore` — один склад: `store.meta.href` (id склада извлекается вызывающим
// кодом через `extractIdFromHref`, см. moysklad-sync.mappers.ts), `onPeriodEnd.{quantity,sum}` —
// остаток и себестоимость на этом складе на конец периода. Как и в TurnoverAllRowSchema,
// `onPeriodEnd` не optional — обязателен в реальном ответе API для строки отчёта.
const StockByStoreEntrySchema = z
    .object({
        store: z.object({
            meta: z.object({ href: z.string() }),
        }),
        onPeriodEnd: z.object({
            quantity: z.number(),
            sum: z.number(),
        }),
    })
    .passthrough();

export const TurnoverByStoreRowSchema = z
    .object({
        assortment: z.object({
            meta: z.object({
                href: z.string(),
                type: z.string(),
            }),
        }),
        stockByStore: z.array(StockByStoreEntrySchema),
    })
    .passthrough();

export type TurnoverByStoreRow = z.infer<typeof TurnoverByStoreRowSchema>;

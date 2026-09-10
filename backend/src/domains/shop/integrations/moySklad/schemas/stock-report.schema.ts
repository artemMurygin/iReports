import { Logger } from '@nestjs/common';
import { z } from 'zod';

// GET /report/stock/bystore?groupBy=product (shop-turnover-report D5) —
// строка на товар (row.meta — ссылка на товар) с разбивкой остатка по
// складам (stockByStore). Имена полей подтверждены design.md (Context,
// см. StockAll: `stock` (шт.), `price` (себестоимость, коп.)) — bystore-
// вариант отличается только тем, что даёт эти же поля в разбивке по
// складам, а не одной агрегированной строкой. Неподтверждён до конца
// документацией именно КОНТРАКТ ОПРОСА асинхронной задачи (не имена полей
// строки) — это обрабатывается в MoyskladService (см. "Открытые вопросы"
// design.md), а не здесь.
//
// На реальном аккаунте МойСклад иногда отдаёт запись stockByStore без
// "price" (по всей видимости — товар без известной себестоимости на
// складе). Раз в этом отчёте нет инъекции `warn`-колбэка, как у
// toAssortmentStockRow (schema.parse здесь вызывается универсально из
// MoyskladService._fetchPaged/_fetchStockByStoreAsync) — используем
// Logger напрямую и дефолт 0, а не падение всего батча.
const StockByStoreEntrySchema = z
    .object({
        meta: z.object({ href: z.string() }),
        stock: z.number(),
        price: z.number().optional(),
    })
    .passthrough()
    .transform((entry) => {
        if (entry.price === undefined) {
            Logger.warn(
                `/report/stock/bystore: поле "price" отсутствует у ${entry.meta.href}, себестоимость принята за 0`,
                'StockByStoreSchema',
            );
        }
        return { ...entry, price: entry.price ?? 0 };
    });

export const StockByStoreRowSchema = z
    .object({
        meta: z.object({ href: z.string() }),
        stockByStore: z.array(StockByStoreEntrySchema),
    })
    .passthrough();

export type StockByStoreRow = z.infer<typeof StockByStoreRowSchema>;

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
const StockByStoreEntrySchema = z
    .object({
        meta: z.object({ href: z.string() }),
        stock: z.number(),
        price: z.number(),
    })
    .passthrough();

export const StockByStoreRowSchema = z
    .object({
        meta: z.object({ href: z.string() }),
        stockByStore: z.array(StockByStoreEntrySchema),
    })
    .passthrough();

export type StockByStoreRow = z.infer<typeof StockByStoreRowSchema>;

import { z } from 'zod';

// GET /report/turnover/all?momentFrom=...&momentTo=...&withoutTurnover=true (design.md D1, шаг
// 1, fix-shop-turnover-historical-stock-cost) — строка отчёта "Обороты" на товар/модификацию, без
// разбивки по складам. `assortment.meta.href`/`type` — ссылка на товар (используется на шаге 2 для
// запроса /report/turnover/bystore; `type` нужен, чтобы выбрать имя параметра фильтра
// product/variant — см. design.md "Risks", `filter=product=` не работает для `variant`).
// `onPeriodEnd.{quantity,sum}` — остаток и его себестоимость на конец периода (`momentTo`),
// единственный проверенный источник исторической себестоимости (см. proposal.md — Why).
// `onPeriodEnd` в реальном ответе API обязателен для строки отчёта — его отсутствие означает
// неожиданный формат ответа, поэтому, в отличие от StockByStoreEntrySchema (stock-report.schema.ts,
// где `price` осознанно optional с дефолтом), здесь поле не делается optional/defaulted.
export const TurnoverAllRowSchema = z
    .object({
        assortment: z.object({
            meta: z.object({
                href: z.string(),
                type: z.string(),
            }),
        }),
        onPeriodEnd: z.object({
            quantity: z.number(),
            sum: z.number(),
        }),
    })
    .passthrough();

export type TurnoverAllRow = z.infer<typeof TurnoverAllRowSchema>;

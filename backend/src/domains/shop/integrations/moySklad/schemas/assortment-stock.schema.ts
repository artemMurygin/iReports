import { z } from 'zod';

// GET /entity/assortment?filter=stockMoment=...;stockStore=... (легаси,
// используется только для разового бэкфилла истории остатков, см.
// design.md D5.1). Открытый вопрос design.md разрешён проверкой реального
// ответа API: строка отдаёт остаток в `stock` (шт.) и себестоимость единицы
// в `buyPrice.value` (коп., объект `{ value, currency }`, тот же формат,
// что у `salePrices[].value`/`minPrice.value`) — НЕ плоское поле `price`,
// как ожидалось по аналогии со StockAll (design.md D5, /report/stock/
// bystore, см. stock-report.schema.ts): та строка отдаёт уже готовую сумму
// себестоимости на складе одним числом, а не цену за единицу. costSum здесь
// — расчётное поле (`quantity × buyPrice.value`), приводимое к той же
// семантике "сумма на складе", которую ждёт RebuildGoodsTurnoverReportService
// (использует costSum как есть, без домножения на quantity). Эта функция —
// единственная точка сопоставления полей: при дальнейшем расхождении на
// реальном аккаунте достаточно поправить её. `warn` вызывается при
// использовании запасного имени поля или нулевого значения по умолчанию —
// по прод-логам бэкфилла будет видно, если реальные имена полей другие.
const RawAssortmentStockRowSchema = z
    .object({
        meta: z.object({ href: z.string() }),
    })
    .passthrough();

export interface AssortmentStockRow {
    productHref: string;
    quantity: number;
    costSum: number;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' ? value : undefined;
}

export function toAssortmentStockRow(
    raw: unknown,
    warn: (message: string) => void,
): AssortmentStockRow {
    const parsed = RawAssortmentStockRowSchema.parse(raw) as {
        meta: { href: string };
    } & Record<string, unknown>;
    const href = parsed.meta.href;

    let quantity = asNumber(parsed.stock);
    if (quantity === undefined) {
        quantity = asNumber(parsed.quantity);
        warn(
            `/entity/assortment: поле "stock" отсутствует у ${href}, используем "quantity" = ${String(quantity)}`,
        );
    }
    if (quantity === undefined) {
        warn(
            `/entity/assortment: нет ни "stock", ни "quantity" у ${href}, остаток принят за 0`,
        );
        quantity = 0;
    }

    const buyPrice = parsed.buyPrice;
    let buyPriceValue =
        typeof buyPrice === 'object' && buyPrice !== null && 'value' in buyPrice
            ? asNumber((buyPrice as { value: unknown }).value)
            : undefined;
    if (buyPriceValue === undefined) {
        warn(
            `/entity/assortment: поле "buyPrice.value" отсутствует у ${href}, себестоимость принята за 0`,
        );
        buyPriceValue = 0;
    }

    return {
        productHref: href,
        quantity,
        costSum: Math.round(quantity * buyPriceValue),
    };
}

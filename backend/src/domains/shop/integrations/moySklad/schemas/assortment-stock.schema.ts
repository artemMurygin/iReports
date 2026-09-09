import { z } from 'zod';

// GET /entity/assortment?filter=stockMoment=...;stockStore=... (легаси,
// используется только для разового бэкфилла истории остатков, см.
// design.md D5.1). Точные имена полей остатка/себестоимости в ответе НЕ
// подтверждены документацией, доступной через использованный инструмент
// (design.md "Открытые вопросы") — по аналогии со StockAll (design.md D5)
// ожидаем `stock` (шт.) и `price` (коп.), с запасными именами
// `quantity`/`buyPrice` на случай расхождения. Эта функция — единственная
// точка сопоставления полей: при расхождении на реальном аккаунте
// достаточно поправить её. `warn` вызывается при использовании запасного
// имени поля или нулевого значения по умолчанию — по прод-логам
// бэкфилла будет видно, если реальные имена полей другие.
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

    let price = asNumber(parsed.price);
    if (price === undefined) {
        warn(
            `/entity/assortment: поле "price" отсутствует у ${href}, себестоимость принята за 0`,
        );
        price = 0;
    }

    return {
        productHref: href,
        quantity,
        costSum: Math.round(price),
    };
}

import { z } from 'zod';

const barcodeSchema = z.object({
    code: z.string(),
    type: z.string(), // "code128" встречается, могут быть и другие (ean13, qr и т.д.)
});

const warrantySchema = z.object({
    period: z.number().int(),
    unit: z.enum(['days', 'months', 'years']),
});

export const ProductSchema = z
    .object({
        id: z.number().int().positive(),
        title: z.string(),
        description: z.string(),
        code: z.string(),
        sku: z.string(),
        uom_id: z.number().int(),
        category_id: z.number().int(),

        cost: z.string(), // "0.00"
        // RoApp отдаёт пустой набор цен как `[]` (PHP-массив без ключей), а не `{}` — приводим к record
        prices: z.preprocess(
            (v) => (Array.isArray(v) ? {} : v),
            z.record(z.string(), z.string()),
        ), // { "31038": "0.00", ... }

        barcodes: z.array(barcodeSchema),

        warranty: warrantySchema,
        images: z.array(
            z.object({
                image: z.string(),
                thumbnail: z.string(),
            }),
        ), // в данных пусто, реальная структура неизвестна

        // RoApp не всегда присылает эти флаги (отсутствуют в ответе для части товаров) — не влияют на transform() ниже
        is_dimensions_weight_enabled: z.boolean().default(false),
        is_expiration_tracking_enabled: z.boolean().default(false),
        is_expiring_soon_alert_enabled: z.boolean().default(false),
        is_critical_alert_enabled: z.boolean().default(false),

        default_supplier_id: z.number().int().nullable(),
    })
    .transform((d) => {
        const priceStr = d.prices['543835'] ?? '0';
        const price = Math.round(parseFloat(priceStr));

        return {
            id: d.id,
            name: d.title,
            engeneerBonus: 0, // в API нет, дефолт
            price,
            categoryId: d.category_id,
        };
    });

export type Product = z.infer<typeof ProductSchema>;

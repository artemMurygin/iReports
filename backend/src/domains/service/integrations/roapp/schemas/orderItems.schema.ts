import { z } from 'zod';

// Единица измерения
const uomSchema = z.object({
    id: z.number().int(),
    title: z.string(),
    description: z.string(),
});

// Сущность (товар или услуга)
const entitySchema = z.object({
    id: z.number().int(),
    type: z.string(),
    code: z.string(),
    sku: z.string(),
    sn_accounting: z.boolean(),
    title: z.string(),
    description: z.string(),
    image: z.string(),
    thumbnail: z.string(),
    uom: uomSchema,
    is_hidden: z.boolean(),
});

// Списание со склада
const writeOffSchema = z.object({
    cost: z.number(),
    cellId: z.number().int(),
    goodId: z.number().int(),
    quantity: z.number(),
    sernum_id: z.number().int().nullable(),
    sernum_code: z.string().nullable(),
    warehouseId: z.number().int(),
    repairOrderProductId: z.number().int(),
});

// Скидка
const discountSchema = z.object({
    type: z.enum(['percentage', 'value']),
    percentage: z.number(),
    amount: z.string().transform((value) => Number(value)),
    sponsor: z.string(), // "staff", возможно есть и другие
});

// Гарантия
const warrantySchema = z.object({
    period: z.number().int(),
    unit: z.enum(['days', 'months', 'years']),
});

// Позиция в заказе
export const OrderItemSchema = z
    .object({
        id: z.number().int(),
        created_at: z.string(),
        assignee_id: z.number().int(),

        quantity: z.string().transform((value) => Number(value)),
        price: z.string().transform((value) => Number(value)),
        cost: z.string().transform((value) => Number(value)),

        margin_id: z.number().int().nullable(),
        is_deduction_required: z.boolean(),

        entity: entitySchema,
        comment: z.string(),

        write_offs: z.array(writeOffSchema).nullable(),

        is_refunded: z.boolean(),
        discount: discountSchema,
        warranty: warrantySchema,
        taxes: z.array(z.unknown()), // в данных всегда [], реальная структура неизвестна
        expiration_date: z.string().nullable(),
    })
    .transform((d) => {
        if (d.entity.type === 'service') {
            return {
                id: d.id,
                serviceId: d.entity.id,
                serviceName: d.entity.title,
                quantity: d.quantity,
                price: d.price,
                cost: d.cost,
                discount: d.discount.amount,
                inCatalog: !d.entity.is_hidden,
                engineerId: d.assignee_id,
            };
        } else if (d.entity.type === 'product') {
            return {
                id: d.id,
                productId: d.entity.id,
                quantity: d.quantity,
                price: d.price,
                cost: d.cost,
                discount: d.discount.amount,
                engineerId: d.assignee_id,
            };
        }
    });

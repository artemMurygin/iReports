import { z } from 'zod';

function toStringOrNull(value: string | number | boolean | null | undefined) {
    return value == null ? null : String(value);
}

export const OrderSchema = z
    .object({
        id: z.number().int().positive(),
        number: z.string(),
        status: z.object({
            id: z.number().int(),
            name: z.string(),
            color: z.string(),
        }),
        status_overdue: z.boolean(),

        created_at: z.string(),
        created_by_id: z.number().int(),
        modified_at: z.string(),
        done_at: z.string().nullable(),
        closed_at: z.string().nullable(),
        closed_by_id: z.number().int().nullable(),

        branch_id: z.number().int(),

        order_type: z.object({
            id: z.number().int(),
            name: z.string(),
        }),

        manager_id: z.number().int().nullable(),
        assignee_id: z.number().int().nullable(),
        asset: z.unknown().nullable(),

        client: z.object({
            id: z.number().int(),
            is_organization: z.boolean(),
            name: z.string(),
            first_name: z.string(),
            last_name: z.string(),
            email: z.string(), // не .email() — приходит пустая строка
            phone: z.array(z.string()),
            address: z.string(),
            discount_code: z.string(),
            custom_fields: z.record(z.string(), z.unknown()),
        }),

        payer: z.unknown().nullable(),
        scheduled_for: z.string().nullable(),
        scheduled_to: z.string().nullable(),
        resource: z.unknown().nullable(),

        malfunction: z.string(),
        manager_notes: z.string(),
        engineer_notes: z.string(),
        address: z.string(),
        resume: z.string(),

        estimated_price: z.string(), // приходит строкой "1.00"
        due_date: z.string().nullable(),
        overdue: z.boolean(),
        discount_sum: z.number(),
        payed: z.string(),
        warranty_date: z.string().nullable(),
        urgent: z.boolean(),

        custom_fields: z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean()]).nullable(),
        ),

        is_deduction_required: z.boolean(),
        ad_campaign_id: z.number().int().nullable(),
        total: z.string(),
    })
    .transform((d) => ({
        id: d.id,
        label: d.number,
        bitrixDealId: d.custom_fields.f6162589
            ? Number(d.custom_fields.f6162589)
            : null,
        clientId: d.client.id,
        statusId: d.status.id,
        managerId: d.manager_id,
        createdById: d.created_by_id,
        closedById: d.closed_by_id,
        closedAt: d.closed_at ? new Date(d.closed_at) : null,
        orderTypeId: d.order_type.id,
        marketingSource: d.ad_campaign_id,
        malfunction: d.malfunction,
        discountSum: d.discount_sum,
        payed: Math.round(Number(d.payed)),
        deviceBrand: toStringOrNull(d.custom_fields.f138462),
        deviceModel: toStringOrNull(d.custom_fields.f138457),
        deviceSerial: toStringOrNull(d.custom_fields.f138470),
        deviceColor: toStringOrNull(d.custom_fields.f297762),
        failReason: toStringOrNull(d.custom_fields.f7639343),
        serviceSupplierName: toStringOrNull(d.custom_fields.f10532346),
        onlineManager: toStringOrNull(d.custom_fields.f7960378),
        dueDate: d.due_date ? new Date(d.due_date) : null,
        doneAt: d.done_at ? new Date(d.done_at) : null,
        modifiedAt: new Date(d.modified_at),
        createdAt: new Date(d.created_at),
    }));

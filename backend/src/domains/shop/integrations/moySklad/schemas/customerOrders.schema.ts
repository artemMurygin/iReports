import { z } from 'zod';
import { MoneySchema } from './common.schema';

const MetaRefSchema = z.object({
    meta: z.object({ href: z.string() }),
});

export const CustomerOrderSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        externalCode: z.string(),
        moment: z.string(),
        created: z.string(),
        updated: z.string(),
        sum: MoneySchema,
        vatSum: MoneySchema.optional(),

        state: MetaRefSchema.optional().nullable(),
        organization: MetaRefSchema,
        agent: MetaRefSchema,
        store: MetaRefSchema.optional().nullable(),
        owner: MetaRefSchema.optional().nullable(),

        description: z.string().optional().default(''),
        applicable: z.boolean(),
        vatEnabled: z.boolean().optional(),
        vatIncluded: z.boolean().optional(),

        shipmentAddressScheme: z.string().optional().nullable(),
        deliveryPlannedMoment: z.string().optional().nullable(),
    })
    .transform((d) => ({
        id: d.id,
        name: d.name,
        externalCode: d.externalCode,
        moment: d.moment,
        createdAt: d.created,
        updatedAt: d.updated,
        sum: d.sum,
        stateHref: d.state?.meta.href ?? null,
        organizationHref: d.organization.meta.href,
        agentHref: d.agent.meta.href,
        storeHref: d.store?.meta.href ?? null,
        ownerHref: d.owner?.meta.href ?? null,
        description: d.description,
        applicable: d.applicable,
        deliveryPlannedMoment: d.deliveryPlannedMoment ?? null,
    }));

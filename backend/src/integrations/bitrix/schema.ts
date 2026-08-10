import { z } from 'zod';

export const BitrixDealSchema = z
    .object({
        ID: z.string(),
        TITLE: z.string().nullable(),
        CATEGORY_ID: z.string(),
        STAGE_ID: z.string().nullable(),
        CURRENCY_ID: z.string().nullable(),
        OPPORTUNITY: z.string().nullable(),
        ASSIGNED_BY_ID: z.string().nullable(),
        COMPANY_ID: z.string().nullable().optional(),
        CONTACT_ID: z.string().nullable().optional(),
        DATE_CREATE: z.string(),
        DATE_MODIFY: z.string().nullable(),
        SOURCE_ID: z.string().nullable().optional(),
        UF_CRM_1742462651851: z.string().nullable().optional(),
        UF_CRM_1730472738: z.string().nullable().optional(),
        UF_CRM_1703248170106: z.string().nullable().optional(),
        UF_CRM_1703248232698: z.string().nullable().optional(),
        UF_CRM_1703248682036: z.string().nullable().optional(),
    })
    .transform((d) => ({
        id: Number(d.ID),
        title: d.TITLE,
        categoryId: Number(d.CATEGORY_ID),
        stageId: d.STAGE_ID,
        opportunity: d.OPPORTUNITY ? parseFloat(d.OPPORTUNITY) : 0,
        assignedById: Number(d.ASSIGNED_BY_ID),
        contactId: d.CONTACT_ID ? Number(d.CONTACT_ID) : null,
        pointOfContactId: d.SOURCE_ID ? d.SOURCE_ID : null,
        leadSourceId: d.UF_CRM_1742462651851
            ? Number(d.UF_CRM_1742462651851)
            : 0,
        brandId: d.UF_CRM_1730472738 ? Number(d.UF_CRM_1730472738) : null,
        deviceTypeId: d.UF_CRM_1703248170106
            ? Number(d.UF_CRM_1703248170106)
            : 0,
        deviceModel: d.UF_CRM_1703248232698 ?? null,
        deviceMalfunction: d.UF_CRM_1703248682036 ?? null,
        createdAt: new Date(d.DATE_CREATE),
        updatedAt: d.DATE_MODIFY ? new Date(d.DATE_MODIFY) : null,
    }));

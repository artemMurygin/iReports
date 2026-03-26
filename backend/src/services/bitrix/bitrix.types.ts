import * as z from "zod";

export const BitrixDealSchema = z.object({
    ID: z.string(),
    TITLE: z.string().nullable(),
    STAGE_ID: z.string().nullable(),
    CURRENCY_ID: z.number().nullable(),
    OPPORTUNITY: z.string().nullable(),
    ASSIGNED_BY_ID: z.number().nullable(),
    COMPANY_ID: z.number().nullable().optional(),
    CONTACT_ID: z.string().nullable().optional(),
    DATE_CREATE: z.string(),
    DATE_MODIFY: z.string().nullable(),
    SOURCE_ID: z.number().nullable().optional(),
    UF_CRM_1742462651851: z.string().nullable().optional(),
    UF_CRM_1730472738: z.string().nullable().optional(),
    UF_CRM_1703248170106: z.string().nullable().optional(),
    UF_CRM_1703248232698: z.string().nullable().optional(),
    UF_CRM_1703248682036: z.string().nullable().optional(),
})

export type RawBitrixDeal = z.infer<typeof BitrixDealSchema>;

export type Filter = {
    CATEGORY_ID: number;
    '>=DATE_MODIFY'?: string;
    '>=DATE_CREATE'?: string;
}
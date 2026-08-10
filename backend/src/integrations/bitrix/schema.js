"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitrixDealSchema = void 0;
var zod_1 = require("zod");
exports.BitrixDealSchema = zod_1.z
    .object({
    ID: zod_1.z.string(),
    TITLE: zod_1.z.string().nullable(),
    CATEGORY_ID: zod_1.z.string(),
    STAGE_ID: zod_1.z.string().nullable(),
    CURRENCY_ID: zod_1.z.string().nullable(),
    OPPORTUNITY: zod_1.z.string().nullable(),
    ASSIGNED_BY_ID: zod_1.z.string().nullable(),
    COMPANY_ID: zod_1.z.string().nullable().optional(),
    CONTACT_ID: zod_1.z.string().nullable().optional(),
    DATE_CREATE: zod_1.z.string(),
    DATE_MODIFY: zod_1.z.string().nullable(),
    SOURCE_ID: zod_1.z.string().nullable().optional(),
    UF_CRM_1742462651851: zod_1.z.string().nullable().optional(),
    UF_CRM_1730472738: zod_1.z.string().nullable().optional(),
    UF_CRM_1703248170106: zod_1.z.string().nullable().optional(),
    UF_CRM_1703248232698: zod_1.z.string().nullable().optional(),
    UF_CRM_1703248682036: zod_1.z.string().nullable().optional(),
})
    .transform(function (d) {
    var _a, _b;
    return ({
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
        deviceModel: (_a = d.UF_CRM_1703248232698) !== null && _a !== void 0 ? _a : null,
        deviceMalfunction: (_b = d.UF_CRM_1703248682036) !== null && _b !== void 0 ? _b : null,
        createdAt: new Date(d.DATE_CREATE),
        updatedAt: d.DATE_MODIFY ? new Date(d.DATE_MODIFY) : null,
    });
});

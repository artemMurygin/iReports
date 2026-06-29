import { z } from 'zod';

const MetaSchema = z.object({
  href: z.string().url(),
  metadataHref: z.string().url().optional(),
  type: z.string(),
  mediaType: z.string(),
  uuidHref: z.string().url().optional(),
  downloadHref: z.string().url().optional(),
});

const MetaWrapperSchema = z.object({ meta: MetaSchema });

const DemandPositionSchema = z.object({
  meta: MetaSchema,
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  quantity: z.number(),
  price: z.number(),
  discount: z.number(),
  vat: z.number().int(),
  vatEnabled: z.boolean(),
  overhead: z.number().optional(),
  assortment: z
    .object({
      meta: MetaSchema,
      id: z.string().uuid(),
      name: z.string(),
    })
    .passthrough()
    .optional(),
  stock: z
    .object({
      cost: z.number(),
      quantity: z.number(),
      reserve: z.number(),
      intransit: z.number(),
      available: z.number(),
    })
    .optional(),
});

export type DemandPosition = z.infer<typeof DemandPositionSchema>;

const PositionsSchema = z.object({
  meta: MetaSchema,
  rows: z.array(DemandPositionSchema).optional(),
});

const RateSchema = z.object({
  currency: MetaWrapperSchema,
  value: z.number().optional(),
});

const ShipmentAddressFullSchema = z.object({
  postalCode: z.string().max(6).nullable().optional(),
  country: MetaWrapperSchema.nullable().optional(),
  region: MetaWrapperSchema.nullable().optional(),
  city: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  house: z.string().nullable().optional(),
  apartment: z.string().nullable().optional(),
  addInfo: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
});

// Кастомный атрибут «Онлайн-менеджер» (тип employee) — value приходит как MetaWrapper
const OnlineManagerAttributeSchema = z.object({
  meta: MetaSchema,
  id: z.literal('3d26eddb-e7c9-11ef-0a80-04b40036c7c1'),
  name: z.literal('Онлайн-менеджер'),
  type: z.literal('employee'),
  value: MetaWrapperSchema.nullable().optional(),
});

// Кастомный атрибут «Фискализация чека» (тип boolean)
const FiscalAttributeSchema = z.object({
  meta: MetaSchema,
  id: z.literal('000f9ddc-016c-11f0-0a80-040a0014448e'),
  name: z.literal('Фискализация чека'),
  type: z.literal('boolean'),
  value: z.boolean().nullable().optional(),
});

const DemandAttributeSchema = z.union([
  OnlineManagerAttributeSchema,
  FiscalAttributeSchema,
  // fallback для возможных новых атрибутов
  z.object({
    meta: MetaSchema,
    id: z.string().uuid(),
    name: z.string(),
    type: z.string(),
    value: z.unknown(),
  }),
]);

// Платёж, привязанный к отгрузке
const LinkedPaymentSchema = z.object({
  meta: MetaSchema,
  linkedSum: z.number().optional(),
});

export const DemandSchema = z.object({
  accountId: z.string().uuid(),
  agent: MetaWrapperSchema,
  applicable: z.boolean(),
  created: z.string().datetime({ offset: true }),
  externalCode: z.string().max(255),
  id: z.string().uuid(),
  meta: MetaSchema,
  moment: z.string().datetime({ offset: true }),
  name: z.string().max(255),
  organization: MetaWrapperSchema,
  owner: MetaWrapperSchema,
  payedSum: z.number(),
  positions: PositionsSchema,
  printed: z.boolean(),
  published: z.boolean(),
  rate: RateSchema,
  shared: z.boolean(),
  sum: z.number(),
  updated: z.string().datetime({ offset: true }),

  agentAccount: MetaWrapperSchema.nullable().optional(),
  attributes: z.array(DemandAttributeSchema).optional(),
  code: z.string().max(255).nullable().optional(),
  contract: MetaWrapperSchema.nullable().optional(),
  customerOrder: MetaWrapperSchema.nullable().optional(),
  deleted: z.string().datetime({ offset: true }).nullable().optional(),
  description: z.string().max(4096).nullable().optional(),
  group: MetaWrapperSchema.optional(),
  invoicesOut: z.array(MetaWrapperSchema).optional(),
  organizationAccount: MetaWrapperSchema.nullable().optional(),
  overhead: z
    .object({
      sum: z.number(),
      distribution: z.enum(['weight', 'volume', 'price']),
    })
    .nullable()
    .optional(),
  payments: z.array(LinkedPaymentSchema).optional(),
  project: MetaWrapperSchema.nullable().optional(),
  returns: z.array(MetaWrapperSchema).optional(),
  salesChannel: MetaWrapperSchema.nullable().optional(),
  shipmentAddress: z.string().max(255).nullable().optional(),
  shipmentAddressFull: ShipmentAddressFullSchema.nullable().optional(),
  state: MetaWrapperSchema.nullable().optional(),
  store: MetaWrapperSchema.nullable().optional(),
  taxSystem: z
    .enum([
      'GENERAL_TAX_SYSTEM',
      'PATENT_BASED',
      'PRESUMPTIVE_TAX_SYSTEM',
      'SIMPLIFIED_TAX_SYSTEM_INCOME',
      'SIMPLIFIED_TAX_SYSTEM_INCOME_OUTCOME',
      'TAX_SYSTEM_SAME_AS_GROUP',
      'UNIFIED_AGRICULTURAL_TAX',
    ])
    .nullable()
    .optional(),
  vatEnabled: z.boolean().optional(),
  vatIncluded: z.boolean().optional(),
  vatSum: z.number().optional(),
});

export type Demand = z.infer<typeof DemandSchema>;

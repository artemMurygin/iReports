import { z } from 'zod';

// Обновление цен услуг RemOnline (Фаза 7,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// контракт для `POST /v1/service/marketing/pricing/update-service-prices`,
// нового дома сервисной половины `POST /price-monitoring/update-service-price`
// (см. src/TODO/priceMonitoring/dto/updateServicePricesInRoapp.dto.ts).
// Форма запроса скопирована с легаси-DTO без изменений (`id`/`price`/
// `serviceCost`, все числа как есть, без `.nonnegative()`) — неотрицательность
// цены/себестоимости проверяет доменный VO ServicePriceChange
// (domains/service/modules/marketing/pricing/domain/value-objects), а не
// контракт: это доменный инвариант, а не форма транспорта.

const updateServicePricesItemSchema = z.object({
    id: z.number().int().positive(),
    price: z.number(),
    serviceCost: z.number(),
});
export type UpdateServicePricesItem = z.infer<
    typeof updateServicePricesItemSchema
>;

const updateServicePricesRequestSchema = z.array(
    updateServicePricesItemSchema,
);
export type UpdateServicePricesRequest = z.infer<
    typeof updateServicePricesRequestSchema
>;

// Форма ответа — как есть от CustomApiRoapp /updateServices (см.
// domains/service/integrations/custom-api-roapp/schemas/updateServices.schema.ts),
// продублирована здесь как контракт эндпоинта, а не переиспользована из
// integrations/*, потому что contracts/ не знает про backend-модули.
const updateServicePricesResponseSchema = z.object({
    success: z.boolean(),
    count: z.object({
        total: z.number(),
        valid: z.number(),
        create: z.number(),
        update: z.number(),
        errors: z.number(),
    }),
});
export type UpdateServicePricesResponse = z.infer<
    typeof updateServicePricesResponseSchema
>;

export {
    updateServicePricesItemSchema,
    updateServicePricesRequestSchema,
    updateServicePricesResponseSchema,
};

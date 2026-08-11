import { z } from 'zod';
import { shopSalaryRuleRequestSchema } from './shop-salary-rule';

// Контракт мотивации магазина (Фаза 13.5) — по прямой аналогии с
// shop-salary-rule.ts: отдельный от сервисного MotivationRequestSchema
// (contracts/commands/motivation-schema.ts) объект, а не расширение его
// `rules` до union обоих направлений — тот файл уже зафиксировал этот же
// принцип для набора типов правил (issue #57: направления технически не
// связаны одним объектом). `rules` здесь — shopSalaryRuleRequestSchema[],
// а не salaryRuleRequestSchema[] сервиса.
const ShopMotivationRequestSchema = z.object({
    targetType: z.enum(['Department', 'Employee']),
    targetId: z.number(),
    name: z.string(),
    rules: z.array(shopSalaryRuleRequestSchema),
});

export type ShopMotivationRequest = z.infer<typeof ShopMotivationRequestSchema>;
export type ShopMotivationResponse = {
    id: string;
};

export { ShopMotivationRequestSchema };

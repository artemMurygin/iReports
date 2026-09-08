import { z } from 'zod';
import {
    payPerHourShopSalaryConfigSchema,
    productSoldSalaryConfigSchema,
    usedProductSoldSalaryConfigSchema,
} from 'ireports-contracts';
import { shopSalaryRuleRegistry } from '@/domains/shop/modules/accounting/domain/salary-rule-registry';

// Зеркало domains/service/modules/accounting/infrastructure/schemas/
// salary-rule.schema.ts (issue #57) — независимая копия для направления
// shop. Схемы конфига большинства типов правил берём из ireports-contracts
// напрямую — их конфиг остаётся одними и теми же данными от HTTP-запроса
// до jsonb-колонки `props` в БД без трансформаций (см.
// ShopSalaryRuleMapper.toDomain).
//
// TaskCompletion — ИСКЛЮЧЕНИЕ (openspec/changes/replace-bitrix-task-integration,
// design.md решение 2/4): персистентная/доменная форма конфига
// (taskIdByPeriod: Record<period, taskId>) больше НЕ совпадает с формой
// wire-запроса (TaskCompletionShopSalaryConfigRequest из contracts несёт
// одиночный taskId текущего периода, не карту) — таскIdByPeriod существует
// только на стороне accounting, contracts её не описывает как схему для
// парсинга самого запроса. Поэтому здесь — собственная, локальная zod-схема
// персистентной формы, не импортированная из contracts.
const taskCompletionShopPersistedConfigSchema = z.object({
    taskIdByPeriod: z.record(z.string(), z.string()),
    taskTitleTemplate: z.string(),
    taskDescriptionTemplate: z.string().optional(),
    isRecurring: z.boolean(),
    deadlineTemplate: z.string(),
    defaultAmount: z.number().int().nonnegative(),
});

// Partial<Record<...>>, а не `as const`: ключ типа — ShopSalaryRuleTypes из
// contracts, а перечень реализованных схем конфига держится отдельно.
// Partial заставляет вызывающий код (ShopSalaryRuleMapper.toDomain) явно
// проверить `undefined`, а не молча получить `any` на несуществующем ключе.
export const shopSalaryRuleConfigSchemaByType: Partial<
    Record<string, z.ZodTypeAny>
> = {
    PayPerHour: payPerHourShopSalaryConfigSchema,
    ProductSold: productSoldSalaryConfigSchema,
    UsedProductSold: usedProductSoldSalaryConfigSchema,
    TaskCompletion: taskCompletionShopPersistedConfigSchema,
};

// Список типов берём из ключей реестра, а не хардкодим второй раз — так
// zod-enum не может рассинхронизироваться с shopSalaryRuleRegistry.
export const shopSalaryRuleTypeSchema = z.enum(
    Array.from(shopSalaryRuleRegistry.keys()) as [string, ...string[]],
);

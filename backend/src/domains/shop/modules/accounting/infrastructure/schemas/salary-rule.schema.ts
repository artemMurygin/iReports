import { z } from 'zod';
import {
    payPerHourShopSalaryConfigSchema,
    productSoldSalaryConfigSchema,
    usedProductSoldSalaryConfigSchema,
    departmentPercentShopSalaryConfigSchema,
    departmentPlanBonusShopSalaryConfigSchema,
    departmentTurnoverBonusShopSalaryConfigSchema,
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
//
// split-task-completion-rule-form — discriminatedUnion по `isRecurring`, зеркало
// TaskCompletionShopSalaryConfig (domain/types/salary-rule.types.ts) и
// taskCompletionSalaryConfigResponseSchema контракта (направление service): шаблонные поля
// (taskTitleTemplate/taskDescriptionTemplate/deadlineTemplate/deadlinePeriodOffset/
// taskLinkTemplates) существуют только у регулярного правила — у разового ShopSalaryRuleMapper
// (toPersistence: `props: entity.config`) их структурно не пишет вовсе. Лишние поля в уже
// персистированных строках (легаси-формат до этого change писал их безусловно, даже для
// isRecurring: false) zod молча отбрасывает — не strict().
const taskCompletionShopPersistedAccountingPeriodFieldSchema = z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Период должен быть в формате YYYY-MM')
    // Опционально (в отличие от domain-типа TaskCompletionShopSalaryConfig, где поле
    // обязательное) — зеркало service (add-task-salary-rule-accounting-period, design.md
    // решение 1): уже персистированные строки TaskCompletion, созданные до этой фичи, не
    // содержат accountingPeriod в props. ShopSalaryRuleMapper.toDomain деривирует его при
    // отсутствии, поэтому парсинг не должен падать на легаси-строках.
    .optional();

const taskCompletionShopOneOffPersistedConfigSchema = z.object({
    isRecurring: z.literal(false),
    taskIdByPeriod: z.record(z.string(), z.string()),
    defaultAmount: z.number().int().nonnegative(),
    accountingPeriod: taskCompletionShopPersistedAccountingPeriodFieldSchema,
});

const taskCompletionShopRecurringPersistedConfigSchema = z.object({
    isRecurring: z.literal(true),
    taskIdByPeriod: z.record(z.string(), z.string()),
    taskTitleTemplate: z.string(),
    taskDescriptionTemplate: z.string().optional(),
    deadlineTemplate: z.string(),
    // recurring-task-deadline-offset, tasks.md раздел 7 (design.md решение 4) —
    // опционально здесь по той же причине, что и accountingPeriod выше:
    // уже персистированные строки TaskCompletion, созданные до этого
    // изменения, не содержат deadlinePeriodOffset в props.
    // ShopSalaryRuleMapper.toDomain деривирует его при отсутствии (0), поэтому
    // парсинг не должен падать на легаси-строках. Обычное число (не через
    // схему-обёртку VO) — зеркало формы хранения остальных примитивов конфига,
    // см. WHY у TaskCompletionShopSalaryConfig.deadlinePeriodOffset.
    deadlinePeriodOffset: z.number().int().min(0).max(3).optional(),
    taskLinkTemplates: z
        .array(z.object({ url: z.string(), label: z.string().optional() }))
        .optional(),
    defaultAmount: z.number().int().nonnegative(),
    accountingPeriod: taskCompletionShopPersistedAccountingPeriodFieldSchema,
});

const taskCompletionShopPersistedConfigSchema = z.discriminatedUnion(
    'isRecurring',
    [
        taskCompletionShopOneOffPersistedConfigSchema,
        taskCompletionShopRecurringPersistedConfigSchema,
    ],
);

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
    // Implements FR2-FR4 of add-department-head-salary-rules (tasks.md раздел 13).
    DepartmentPercent: departmentPercentShopSalaryConfigSchema,
    DepartmentPlanBonus: departmentPlanBonusShopSalaryConfigSchema,
    DepartmentTurnoverBonus: departmentTurnoverBonusShopSalaryConfigSchema,
};

// Список типов берём из ключей реестра, а не хардкодим второй раз — так
// zod-enum не может рассинхронизироваться с shopSalaryRuleRegistry.
export const shopSalaryRuleTypeSchema = z.enum(
    Array.from(shopSalaryRuleRegistry.keys()) as [string, ...string[]],
);

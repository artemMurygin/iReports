import { z } from 'zod';
import {
    orderPayedSalaryConfigSchema,
    payPerHourSalaryConfigSchema,
    serviceCompletedSalaryConfigSchema,
    taskCompletedSalaryConfigSchema,
} from 'ireports-contracts';
import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';

// Схемы конфига берём из ireports-contracts, а не дублируем руками: конфиг
// правила — одни и те же данные от HTTP-запроса до jsonb-колонки `props` в
// БД без трансформаций, так что контракт может служить единственным
// источником правды и для валидации запроса, и для валидации чтения из БД
// (см. SalaryRuleMapper.toDomain).
//
// Partial<Record<...>>, а не `as const`: ключ типа — SalaryRuleTypes из
// contracts, а перечень реализованных схем конфига держится отдельно (все
// четыре типа сервиса реализованы начиная с Фазы 8). Partial заставляет
// вызывающий код (SalaryRuleMapper.toDomain) явно проверить `undefined`, а
// не молча получить `any` на несуществующем ключе.
export const salaryRuleConfigSchemaByType: Partial<
    Record<string, z.ZodTypeAny>
> = {
    PayPerHour: payPerHourSalaryConfigSchema,
    ServiceCompleted: serviceCompletedSalaryConfigSchema,
    OrderPayed: orderPayedSalaryConfigSchema,
    TaskCompleted: taskCompletedSalaryConfigSchema,
};

// Список типов берём из ключей реестра, а не хардкодим второй раз — так
// zod-enum не может рассинхронизироваться с salaryRuleRegistry.
export const salaryRuleTypeSchema = z.enum(
    Array.from(salaryRuleRegistry.keys()) as [string, ...string[]],
);

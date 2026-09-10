import { z } from 'zod';
import {
    orderPayedSalaryConfigSchema,
    payPerHourSalaryConfigSchema,
    serviceCompletedSalaryConfigSchema,
    taskCompletionSalaryConfigResponseSchema,
    departmentPercentSalaryConfigSchema,
    departmentPlanBonusSalaryConfigSchema,
    departmentTurnoverBonusSalaryConfigSchema,
} from 'ireports-contracts';
import { salaryRuleRegistry } from '@/domains/service/modules/accounting/domain/salary-rule-registry';

// Схемы конфига берём из ireports-contracts, а не дублируем руками: конфиг
// правила — одни и те же данные от HTTP-запроса до jsonb-колонки `props` в
// БД без трансформаций, так что контракт может служить единственным
// источником правды и для валидации запроса, и для валидации чтения из БД
// (см. SalaryRuleMapper.toDomain) — ЗА ИСКЛЮЧЕНИЕМ TaskCompletion
// (replace-bitrix-task-integration, design.md решение 2/4): персистентный
// config (`taskIdByPeriod`) — это форма ОТВЕТА API
// (`taskCompletionSalaryConfigResponseSchema`), не запроса (запрос несёт
// одноразовый `taskId`, не персистируется как отдельное поле, см.
// TaskCompletion.create()/buildTaskCompletionConfig()).
//
// Partial<Record<...>>, а не `as const`: ключ типа — SalaryRuleTypes из
// contracts, а перечень реализованных схем конфига держится отдельно (все
// четыре типа сервиса реализованы начиная с Фазы 8/раздела 10
// add-task-based-salary-rule). Partial заставляет
// вызывающий код (SalaryRuleMapper.toDomain) явно проверить `undefined`, а
// не молча получить `any` на несуществующем ключе.
export const salaryRuleConfigSchemaByType: Partial<
    Record<string, z.ZodTypeAny>
> = {
    PayPerHour: payPerHourSalaryConfigSchema,
    ServiceCompleted: serviceCompletedSalaryConfigSchema,
    OrderPayed: orderPayedSalaryConfigSchema,
    TaskCompletion: taskCompletionSalaryConfigResponseSchema,
    // Implements FR2-FR4 of add-department-head-salary-rules (tasks.md раздел 12) — config этих 3
    // новых видов правила тоже неизменной формой доходит от запроса до jsonb-колонки `props`, как и
    // у PayPerHour/ServiceCompleted/OrderPayed выше.
    DepartmentPercent: departmentPercentSalaryConfigSchema,
    DepartmentPlanBonus: departmentPlanBonusSalaryConfigSchema,
    DepartmentTurnoverBonus: departmentTurnoverBonusSalaryConfigSchema,
};

// Список типов берём из ключей реестра, а не хардкодим второй раз — так
// zod-enum не может рассинхронизироваться с salaryRuleRegistry.
export const salaryRuleTypeSchema = z.enum(
    Array.from(salaryRuleRegistry.keys()) as [string, ...string[]],
);

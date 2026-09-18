import {
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { Entity } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { shopSalaryRuleRegistry } from '@/domains/shop/modules/accounting/domain/salary-rule-registry';
import {
    ShopSalaryRule,
    ShopSalaryRuleTypes,
    TaskCompletionShopSalaryConfig,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { targetRoleSchema } from 'ireports-contracts';
import {
    shopSalaryRuleConfigSchemaByType,
    shopSalaryRuleTypeSchema,
} from '../../schemas/salary-rule.schema';

// Зеркало domains/service/modules/accounting/infrastructure/mappers/
// salary-rule.mapper.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop.
//
// Направление (record.direction) здесь не проверяется намеренно —
// фильтрация "только правила shop" происходит на уровне Prisma-запроса в
// ShopMotivationSchemaRepository (`include: { rules: { where: { direction:
// 'shop' } } }`), поэтому сюда в норме не попадают чужие строки. Если
// попадут (например, прямой вызов в обход репозитория) —
// shopSalaryRuleRegistry.get(type) всё равно не найдёт класс для
// незнакомого/чужого типа и бросит осмысленную ошибку ниже, а не молча
// проглотит чужое правило.
export class ShopSalaryRuleMapper implements Mapper<
    ShopSalaryRule,
    Omit<Prisma.SalaryRuleUncheckedCreateInput, 'motivationSchemaId'>
> {
    toDomain(record: SalaryRuleRecord): ShopSalaryRule {
        const type = shopSalaryRuleTypeSchema.parse(
            record.type,
        ) as ShopSalaryRuleTypes;
        const RuleClass = shopSalaryRuleRegistry.get(type);
        if (!RuleClass) {
            throw new Error(
                `Не удалось определить класс зарплатного правила для типа: ${type}`,
            );
        }
        const configSchema = shopSalaryRuleConfigSchemaByType[type];
        if (!configSchema) {
            throw new Error(
                `Нет схемы конфига для зарегистрированного типа правила: ${type}`,
            );
        }
        const config = configSchema.parse(record.props);
        const targetRole = targetRoleSchema.parse(record.targetRole);

        // add-task-salary-rule-accounting-period, design.md решение 1 —
        // зеркало SalaryRuleMapper.toDomain направления service: props уже
        // персистированных строк TaskCompletion, созданных до этой фичи, не
        // содержит accountingPeriod (схема выше парсит его как опциональное
        // поле) — деривируем один раз здесь, на границе маппера, чтобы
        // дальше в домене и в API-ответе поле всегда присутствовало.
        // Источник — максимальный (лексикографически, корректно для формата
        // YYYY-MM) ключ taskIdByPeriod, а если карта пуста —
        // Period.current() как последний резервный случай.
        if (type === 'TaskCompletion') {
            const taskCompletionConfig =
                config as TaskCompletionShopSalaryConfig;
            if (!taskCompletionConfig.accountingPeriod) {
                const periods = Object.keys(
                    taskCompletionConfig.taskIdByPeriod,
                );
                taskCompletionConfig.accountingPeriod =
                    periods.length > 0
                        ? periods.sort().at(-1)!
                        : Period.current().getValue();
            }

            // recurring-task-deadline-offset, tasks.md раздел 7 (design.md
            // решение 4) — та же деривация для легаси-строк, что и у
            // accountingPeriod выше: строки, персистированные до этого
            // изменения, не содержат deadlinePeriodOffset — воспроизводим
            // точное прежнее поведение (дедлайн внутри месяца периода).
            //
            // split-task-completion-rule-form — deadlinePeriodOffset структурно существует только
            // у регулярного правила (TaskCompletionShopSalaryConfig, discriminatedUnion по
            // isRecurring): у разового его в конфиге вообще нет, а не undefined, деривировать
            // нечего.
            if (
                taskCompletionConfig.isRecurring &&
                taskCompletionConfig.deadlinePeriodOffset === undefined
            ) {
                taskCompletionConfig.deadlinePeriodOffset = 0;
            }
        }

        // Entity.constructor вызывает validate() сам (entity.base.ts) —
        // те же инварианты FloatPercent, что и при записи (см.
        // ProductSoldEntity.validate() и т.п.), проверяются и здесь: если в
        // БД всё же оказались невалидные данные, чтение упадёт, а не молча
        // посчитает зарплату по испорченному правилу (fail closed).
        return new RuleClass({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                name: record.name,
                type,
                targetRole,
                config,
                isActive: record.isActive,
            },
        });
    }
    toPersistence(
        entity: ShopSalaryRule,
    ): Omit<Prisma.SalaryRuleUncheckedCreateInput, 'motivationSchemaId'> {
        const { createdAt, updatedAt } = entity as unknown as Entity<unknown>;

        return {
            id: entity.id,
            type: entity.type,
            name: entity.name,
            targetRole: entity.targetRole,
            // Направление правила (Фаза 12) — фиксированное 'shop' для
            // этого мапера: домен shop никогда не пишет чужие правила.
            // См. комментарий у SalaryRule.direction в salary.prisma —
            // почему это поле не на MotivationSchema.
            direction: 'shop',
            isActive: entity.isActive,
            props: entity.config,
            createdAt,
            updatedAt,
        };
    }
}

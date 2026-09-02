import type {
    MotivationSchemaDetailResponse,
    MotivationSchemaListItem,
    SalaryRuleResponse,
} from 'ireports-contracts';
import {
    MotivationSchema as MotivationSchemaRecord,
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationTarget } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import { buildBitrixTaskLink } from '@/integrations/bitrix/bitrix.config';
import { SalaryRuleMapper } from './salary-rule.mapper';

// Правила больше не хранятся в самой строке motivation_schemas (см.
// salary_rules), поэтому чтение схемы обязано приходить с включённой связью.
export type MotivationSchemaRow = MotivationSchemaRecord & {
    rules: SalaryRuleRecord[];
};

export class MotivationSchemaMapper implements Mapper<
    MotivationSchema,
    Prisma.MotivationSchemaCreateInput
> {
    private readonly salaryRuleMapper = new SalaryRuleMapper();

    toDomain(record: MotivationSchemaRow): MotivationSchema {
        return new MotivationSchema({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                target: MotivationTarget.create(
                    record.targetType,
                    record.targetId,
                ),
                // serviceName — direction-специфичное имя (см. комментарий
                // в salary.prisma); фолбэк на общий `name` только для строк,
                // заведённых до миграции add_motivation_schema_direction_name
                // (или ни разу не создававшихся/переименовывавшихся со
                // стороны service).
                name: record.serviceName ?? record.name,
                rules: record.rules.map((rule) =>
                    this.salaryRuleMapper.toDomain(rule),
                ),
            },
        });
    }

    toPersistence(
        entity: MotivationSchema,
    ): Prisma.MotivationSchemaCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            targetType: props.target.getType(),
            targetId: props.target.getId(),
            // `name` — legacy-колонка, заполняется для обратной
            // совместимости (историческое значение первой строки); реально
            // читаемое service-направлением имя — serviceName ниже.
            name: props.name,
            serviceName: props.name,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }

    // Строка списка GET /v1/service/motivation-schema (Фаза "Редактирование
    // зарплатных схем") — ruleCount/ruleTypes/updatedAt считаются здесь, а
    // не в сервисе: маппинг "сущность → ответ" отделён от оркестрации
    // (резолвинг targetName, фильтрация 0-правильных схем). targetName
    // приходит извне — резолвинг Bitrix-справочника не задача этого класса
    // (см. ListMotivationSchemasService).
    toListItemResponse(
        entity: MotivationSchema,
        targetName: string,
    ): MotivationSchemaListItem {
        const props = entity.getProps();
        const rules = props.rules;

        const ruleTypes: string[] = [];
        for (const rule of rules) {
            if (!ruleTypes.includes(rule.type)) {
                ruleTypes.push(rule.type);
            }
        }

        return {
            id: props.id,
            name: props.name,
            direction: 'service',
            target: {
                type: props.target.getType(),
                id: props.target.getId(),
                name: targetName,
            },
            ruleCount: rules.length,
            ruleTypes,
            updatedAt: this.computeUpdatedAt(entity).toISOString(),
        };
    }

    // Деталь GET .../motivation-schema/:id — готова для предзаполнения формы
    // редактирования (id+type+name+targetRole+config каждого правила, см.
    // draftFrom* на фронте). targetName резолвится извне (см.
    // GetMotivationSchemaService), тот же приём разделения ответственности,
    // что и у toListItemResponse.
    toDetailResponse(
        entity: MotivationSchema,
        targetName: string,
    ): MotivationSchemaDetailResponse {
        const props = entity.getProps();
        const rules = props.rules;

        return {
            id: props.id,
            name: props.name,
            direction: 'service',
            target: {
                type: props.target.getType(),
                id: props.target.getId(),
                name: targetName,
            },
            // Каждое доменное правило (PayPerHoursEntity/
            // ServiceCompletedEntity/OrderPayedEntity/TaskCompletedEntity)
            // структурно совпадает с одним из вариантов
            // salaryRuleResponseSchema по (type, targetRole, config) — id
            // добавлен явно (сущность правила его уже несёт). Cast, а не
            // построчная сборка каждого варианта union, — тот же приём, что
            // уже используется в модуле для доменных типов, широких по
            // сравнению с контрактным discriminatedUnion (см.
            // SalaryRuleMapper.toDomain: `salaryRuleTypeSchema.parse(...) as
            // SalaryRuleTypes`).
            rules: rules.map(
                (rule) =>
                    ({
                        id: rule.id,
                        type: rule.type,
                        name: rule.name,
                        targetRole: rule.targetRole,
                        config: rule.config,
                        // bitrixTaskUrl — только TaskCompleted, только когда у
                        // правила уже есть накопленная задача (see
                        // taskCompletedSalaryRuleResponseSchema).
                        ...(rule instanceof TaskCompletedEntity &&
                        rule.bitrixTaskIds.length > 0
                            ? {
                                  bitrixTaskUrl: buildBitrixTaskLink(
                                      rule.bitrixTaskIds[
                                          rule.bitrixTaskIds.length - 1
                                      ],
                                  ),
                              }
                            : {}),
                    }) as SalaryRuleResponse,
            ),
            updatedAt: this.computeUpdatedAt(entity).toISOString(),
        };
    }

    // updatedAt = max(schema.updatedAt, ...rules[].updatedAt) — тот же
    // штамп свежести, что уже использует ленивый кэш расчёта (см.
    // accounting-cache-freshness.ts), чтобы список/деталь отражали правку
    // отдельного правила, а не только переименование схемы.
    private computeUpdatedAt(entity: MotivationSchema): Date {
        const props = entity.getProps();
        return props.rules.reduce(
            (max, rule) => (rule.updatedAt > max ? rule.updatedAt : max),
            props.updatedAt,
        );
    }
}

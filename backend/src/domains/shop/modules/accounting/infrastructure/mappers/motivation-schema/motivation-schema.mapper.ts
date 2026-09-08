import type {
    ShopMotivationSchemaDetailResponse,
    ShopMotivationSchemaListItem,
    ShopSalaryRuleResponse,
} from 'ireports-contracts';
import {
    MotivationSchema as MotivationSchemaRecord,
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/motivation-target.value-object';
import { ShopSalaryRuleMapper } from './salary-rule.mapper';

// Правила больше не хранятся в самой строке motivation_schemas (см.
// salary_rules), поэтому чтение схемы обязано приходить с включённой
// связью. Сама строка motivation_schemas не имеет колонки direction
// (естественный ключ — только targetType/targetId), поэтому её нет и в
// toPersistence ниже — см. комментарий у ShopMotivationSchemaRepository.
export type ShopMotivationSchemaRow = MotivationSchemaRecord & {
    rules: SalaryRuleRecord[];
};

// Зеркало domains/service/modules/accounting/infrastructure/mappers/
// motivation-schema.mapper.ts (Фаза 13.5, issue #57) — независимая копия
// для направления shop.
export class ShopMotivationSchemaMapper implements Mapper<
    ShopMotivationSchema,
    Prisma.MotivationSchemaCreateInput
> {
    private readonly shopSalaryRuleMapper = new ShopSalaryRuleMapper();

    toDomain(record: ShopMotivationSchemaRow): ShopMotivationSchema {
        return new ShopMotivationSchema({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                target: ShopMotivationTarget.create(
                    record.targetType,
                    record.targetId,
                ),
                // shopName — direction-специфичное имя (см. комментарий в
                // salary.prisma); фолбэк на общий `name` только для строк,
                // заведённых до миграции add_motivation_schema_direction_name
                // (или ни разу не создававшихся/переименовывавшихся со
                // стороны shop).
                name: record.shopName ?? record.name,
                rules: record.rules.map((rule) =>
                    this.shopSalaryRuleMapper.toDomain(rule),
                ),
            },
        });
    }

    toPersistence(
        entity: ShopMotivationSchema,
    ): Prisma.MotivationSchemaCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            targetType: props.target.getType(),
            targetId: props.target.getId(),
            // `name` — legacy-колонка, заполняется для обратной
            // совместимости (историческое значение первой строки); реально
            // читаемое shop-направлением имя — shopName ниже.
            name: props.name,
            shopName: props.name,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }

    // Строка списка GET /v1/shop/accounting/motivation-schema —
    // ruleCount/ruleTypes/updatedAt считаются здесь, targetName резолвится
    // извне (см. ListShopMotivationSchemasService).
    toListItemResponse(
        entity: ShopMotivationSchema,
        targetName: string,
    ): ShopMotivationSchemaListItem {
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
            direction: 'shop',
            target: {
                type: props.target.getType(),
                id: props.target.getId(),
                name: targetName,
            },
            ruleCount: rules.length,
            ruleTypes,
            updatedAt: this.computeUpdatedAt(entity),
        };
    }

    // Деталь GET .../motivation-schema/:id — готова для предзаполнения формы
    // редактирования (id+type+name+targetRole+config каждого правила).
    // targetName резолвится извне (см. GetShopMotivationSchemaService), тот
    // же приём разделения ответственности, что и у toListItemResponse.
    toDetailResponse(
        entity: ShopMotivationSchema,
        targetName: string,
    ): ShopMotivationSchemaDetailResponse {
        const props = entity.getProps();
        const rules = props.rules;

        return {
            id: props.id,
            name: props.name,
            direction: 'shop',
            target: {
                type: props.target.getType(),
                id: props.target.getId(),
                name: targetName,
            },
            // Каждое доменное правило структурно совпадает с одним из
            // вариантов shopSalaryRuleResponseSchema по (type, targetRole,
            // config) — id добавлен явно. Cast, а не построчная сборка
            // каждого варианта union'а — тот же приём, что и у
            // ShopSalaryRuleMapper.toDomain.
            rules: rules.map(
                (rule) =>
                    ({
                        id: rule.id,
                        type: rule.type,
                        name: rule.name,
                        targetRole: rule.targetRole,
                        config: rule.config,
                    }) as ShopSalaryRuleResponse,
            ),
            updatedAt: this.computeUpdatedAt(entity),
        };
    }

    // updatedAt = max(schema.updatedAt, ...rules[].updatedAt) — тот же
    // штамп свежести, что уже использует ленивый кэш расчёта, чтобы
    // список/деталь отражали правку отдельного правила, а не только
    // переименование схемы.
    private computeUpdatedAt(entity: ShopMotivationSchema): Date {
        const props = entity.getProps();
        return props.rules.reduce(
            (max, rule) => (rule.updatedAt > max ? rule.updatedAt : max),
            props.updatedAt,
        );
    }
}

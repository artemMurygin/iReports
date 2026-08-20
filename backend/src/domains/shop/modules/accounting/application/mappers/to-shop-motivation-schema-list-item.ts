import type { ShopMotivationSchemaListItem } from 'ireports-contracts';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';

// Зеркало domains/service/modules/accounting/application/mappers/
// to-motivation-schema-list-item.ts (Фаза "Редактирование зарплатных схем",
// issue #57) — независимая копия для направления shop. Строка списка GET
// /v1/shop/accounting/motivation-schema — ruleCount/ruleTypes/updatedAt
// считаются здесь, targetName резолвится извне (см.
// ListShopMotivationSchemasService).
export function toShopMotivationSchemaListItem(
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

    // updatedAt = max(schema.updatedAt, ...rules[].updatedAt) — тот же
    // штамп свежести, что уже использует ленивый кэш расчёта, чтобы список
    // отражал правку отдельного правила, а не только переименование схемы.
    const updatedAt = rules.reduce(
        (max, rule) => (rule.updatedAt > max ? rule.updatedAt : max),
        props.updatedAt,
    );

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
        updatedAt,
    };
}

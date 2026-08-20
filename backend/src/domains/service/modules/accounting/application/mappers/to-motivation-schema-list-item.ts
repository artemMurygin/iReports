import type { MotivationSchemaListItem } from 'ireports-contracts';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';

// Строка списка GET /v1/service/motivation-schema (Фаза "Редактирование
// зарплатных схем") — ruleCount/ruleTypes/updatedAt считаются здесь, а не в
// сервисе, тот же приём разделения "маппинг сущность → ответ" от "оркестрация
// (резолвинг targetName, фильтрация 0-правильных схем)", что и у
// to-employee-hours-entry-response.ts. targetName приходит извне —
// резолвинг Bitrix-справочника не задача этого файла (см.
// ListMotivationSchemasService).
export function toMotivationSchemaListItem(
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

    // updatedAt = max(schema.updatedAt, ...rules[].updatedAt) — тот же
    // штамп свежести, что уже использует ленивый кэш расчёта (см.
    // accounting-cache-freshness.ts), чтобы список отражал правку
    // отдельного правила, а не только переименование схемы.
    const updatedAt = rules.reduce(
        (max, rule) => (rule.updatedAt > max ? rule.updatedAt : max),
        props.updatedAt,
    );

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
        updatedAt: updatedAt.toISOString(),
    };
}

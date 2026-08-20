import type {
    MotivationSchemaDetailResponse,
    SalaryRuleResponse,
} from 'ireports-contracts';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';

// Деталь GET .../motivation-schema/:id — готова для предзаполнения формы
// редактирования (id+type+name+targetRole+config каждого правила, см.
// draftFrom* на фронте). targetName резолвится извне (см.
// GetMotivationSchemaService), тот же приём разделения ответственности, что
// и у to-motivation-schema-list-item.ts.
export function toMotivationSchemaResponse(
    entity: MotivationSchema,
    targetName: string,
): MotivationSchemaDetailResponse {
    const props = entity.getProps();
    const rules = props.rules;

    // updatedAt = max(schema.updatedAt, ...rules[].updatedAt) — см. тот же
    // приём в to-motivation-schema-list-item.ts.
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
        // Каждое доменное правило (PayPerHoursEntity/ServiceCompletedEntity/
        // OrderPayedEntity/TaskCompletedEntity) структурно совпадает с одним
        // из вариантов salaryRuleResponseSchema по (type, targetRole,
        // config) — id добавлен явно (сущность правила его уже несёт).
        // Cast, а не построчная сборка каждого варианта union, — тот же
        // приём, что уже используется в модуле для доменных типов, широких
        // по сравнению с контрактным discriminatedUnion (см.
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
                }) as SalaryRuleResponse,
        ),
        updatedAt: updatedAt.toISOString(),
    };
}

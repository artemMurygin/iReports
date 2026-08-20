import type {
    ShopMotivationSchemaDetailResponse,
    ShopSalaryRuleResponse,
} from 'ireports-contracts';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';

// Зеркало domains/service/modules/accounting/application/mappers/
// to-motivation-schema-response.ts (Фаза "Редактирование зарплатных схем",
// issue #57) — независимая копия для направления shop. Деталь GET
// .../motivation-schema/:id — готова для предзаполнения формы
// редактирования (id+type+name+targetRole+config каждого правила).
// targetName резолвится извне (см. GetShopMotivationSchemaService).
export function toShopMotivationSchemaResponse(
    entity: ShopMotivationSchema,
    targetName: string,
): ShopMotivationSchemaDetailResponse {
    const props = entity.getProps();
    const rules = props.rules;

    // updatedAt = max(schema.updatedAt, ...rules[].updatedAt) — см. тот же
    // приём в to-shop-motivation-schema-list-item.ts.
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
        // Каждое доменное правило структурно совпадает с одним из вариантов
        // shopSalaryRuleResponseSchema по (type, targetRole, config) — id
        // добавлен явно. Cast, а не построчная сборка каждого варианта
        // union'а — тот же приём, что и у ShopSalaryRuleMapper.toDomain.
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
        updatedAt,
    };
}

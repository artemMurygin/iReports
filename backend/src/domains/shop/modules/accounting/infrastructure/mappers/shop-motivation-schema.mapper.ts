import {
    MotivationSchema as MotivationSchemaRecord,
    Prisma,
    SalaryRule as SalaryRuleRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/shop-motivation-target.value-object';
import { ShopSalaryRuleMapper } from './shop-salary-rule.mapper';

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
}

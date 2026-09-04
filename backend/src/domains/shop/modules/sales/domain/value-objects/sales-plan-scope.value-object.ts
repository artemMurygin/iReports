import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface ShopSalesPlanScopeProps {
    department: number;
    category: string | null;
}

// Зеркало domains/service/modules/sales/domain/value-objects/
// sales-plan-scope.value-object.ts (Фаза 7 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. В отличие от сервисного VO
// здесь нет поля `direction`: направление зафиксировано самим расположением
// класса в домене shop (инфраструктурный слой —
// ShopSalesPlanRepository/ShopSalesPlanTemplateRepository — подставляет
// `direction: 'shop'` при работе с общей Prisma-таблицей, см.
// infrastructure/mappers/sales-plan.mapper.ts), тот же приём, что уже
// применён у ShopAccountingPeriod (см. domains/shop/CLAUDE.md). Отдел и,
// опционально, категория всегда меняются
// вместе (это была бы уже другая строка плана/шаблона, а не правка этой) и
// вместе задают естественный ключ (@@unique в sales.prisma в паре с
// зафиксированным direction), поэтому не два голых поля entity, а один
// объект.
export class ShopSalesPlanScope extends ValueObject<ShopSalesPlanScopeProps> {
    static create(
        department: number,
        category: string | null,
    ): ShopSalesPlanScope {
        if (!department) {
            throw new ArgumentInvalidException(
                'Необходимо указать отдел для плана продаж',
            );
        }
        if (category !== null && !category) {
            throw new ArgumentInvalidException(
                'Категория плана продаж должна быть либо непустой строкой, либо отсутствовать',
            );
        }
        return new ShopSalesPlanScope({ department, category });
    }

    getDepartment(): number {
        return this.props.department;
    }

    getCategory(): string | null {
        return this.props.category;
    }
}

import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ShopSalesPlanScope } from '../value-objects/shop-sales-plan-scope.value-object';
import {
    ShopSalesPlanTemplateCreateProps,
    ShopSalesPlanTemplateEditProps,
    ShopSalesPlanTemplateProps,
} from '../types/shop-sales-plan-template.types';

// Зеркало domains/service/modules/sales/domain/entities/
// sales-plan-template.entity.ts (Фаза 7
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop. growthPercent по умолчанию — та же договорённость, что
// у направления service (10%, см. docs/payroll/prd-payroll-calculation.md).
export const DEFAULT_GROWTH_PERCENT = 10;

// Дефолтные значения плана по отделу и, опционально, категории — стартовая
// точка для самого первого месяца направления shop и запасной вариант, если
// плана за предыдущий месяц ещё нет. Как и у ShopSalesPlan, здесь нет поля
// `direction` — направление зафиксировано расположением класса в домене
// shop (см. WHY в ShopSalesPlan).
export class ShopSalesPlanTemplate extends Entity<ShopSalesPlanTemplateProps> {
    declare protected readonly _id: AggregateID;

    static create(
        create: ShopSalesPlanTemplateCreateProps,
    ): ShopSalesPlanTemplate {
        const scope = ShopSalesPlanScope.create(
            create.department,
            create.category ?? null,
        );
        return new ShopSalesPlanTemplate({
            id: randomUUID(),
            props: {
                scope,
                turnover: create.turnover,
                margin: create.margin,
                orderTypeIds: create.orderTypeIds ?? [],
                growthPercent: create.growthPercent ?? DEFAULT_GROWTH_PERCENT,
            },
        });
    }

    get department(): number {
        return this.props.scope.getDepartment();
    }

    get category(): string | null {
        return this.props.scope.getCategory();
    }

    get turnover(): number {
        return this.props.turnover;
    }

    get margin(): number {
        return this.props.margin;
    }

    get growthPercent(): number {
        return this.props.growthPercent;
    }

    get orderTypeIds(): number[] {
        return this.props.orderTypeIds;
    }

    update(patch: ShopSalesPlanTemplateEditProps): void {
        if (patch.turnover !== undefined) {
            this.props.turnover = patch.turnover;
        }
        if (patch.margin !== undefined) {
            this.props.margin = patch.margin;
        }
        if (patch.orderTypeIds !== undefined) {
            this.props.orderTypeIds = patch.orderTypeIds;
        }
        if (patch.growthPercent !== undefined) {
            this.props.growthPercent = patch.growthPercent;
        }
        this.validate();
    }

    validate(): void {
        if (this.props.turnover < 0) {
            throw new ArgumentInvalidException(
                'Плановый оборот шаблона не может быть отрицательным',
            );
        }
        if (this.props.margin < 0) {
            throw new ArgumentInvalidException(
                'Плановая маржа шаблона не может быть отрицательной',
            );
        }
        if (this.props.growthPercent < 0) {
            throw new ArgumentInvalidException(
                'Процент роста шаблона не может быть отрицательным',
            );
        }
    }
}

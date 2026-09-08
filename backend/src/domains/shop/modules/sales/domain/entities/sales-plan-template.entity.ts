import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ShopSalesPlanScope } from '../value-objects/sales-plan-scope.value-object';
import {
    ShopSalesPlanTemplateCreateProps,
    ShopSalesPlanTemplateEditProps,
    ShopSalesPlanTemplateProps,
} from '../types/sales-plan-template.types';

// Зеркало domains/service/modules/sales/domain/entities/
// sales-plan-template.entity.ts (Фаза 7
// docs/service-shop-boundary-violations-fix, sortOrder/reorder() — Фаза 4
// docs/sales-plan-row-drag-and-drop-reorder) — независимая копия для
// направления shop.
// spec: shop/sales#requirement-шаблон-плана-как-отправная-точка-отделакатегории
export const DEFAULT_GROWTH_PERCENT = 10;

// Как и у ShopSalesPlan, здесь нет поля `direction` — направление
// зафиксировано расположением класса в домене shop (см. WHY в ShopSalesPlan).
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
                sortOrder: create.sortOrder ?? 0,
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

    get sortOrder(): number {
        return this.props.sortOrder;
    }

    // Отдельный от update() метод — намеренно, зеркалит SalesPlanTemplate.
    // reorder() направления service (см. UpdateShopSalesPlanOrderHandler).
    // spec: shop/sales#requirement-глобальный-порядок-строк-плана-наследуется-от-шаблона
    reorder(sortOrder: number): void {
        this.props.sortOrder = sortOrder;
        this.validate();
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
        if (!Number.isInteger(this.props.sortOrder)) {
            throw new ArgumentInvalidException(
                'Порядок строки шаблона должен быть целым числом',
            );
        }
    }
}

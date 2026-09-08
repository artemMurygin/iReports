import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { ShopSalesPlanScope } from '../value-objects/sales-plan-scope.value-object';
import { ShopSalesPlanApproval } from '../value-objects/sales-plan-approval.value-object';
import {
    ShopSalesPlanCreateProps,
    ShopSalesPlanEditProps,
    ShopSalesPlanProps,
    SalesPlanSource,
    SalesPlanStatus,
} from '../types/sales-plan.types';

// Зеркало domains/service/modules/sales/domain/entities/sales-plan.entity.ts
// (Фаза 7 docs/service-shop-boundary-violations-fix) — независимая копия
// для направления shop: план на конкретный месяц по отделу и, опционально,
// категории — вход для всех процентных зарплатных правил shop
// (ProductSold/UsedProductSold, см. domains/shop/CLAUDE.md).
//
// В отличие от сервисной сущности здесь нет поля `direction`: направление
// зафиксировано самим расположением класса в домене shop (инфраструктурный
// слой — ShopSalesPlanRepository — подставляет `direction: 'shop'` при
// работе с общей Prisma-таблицей sales_plans, см.
// infrastructure/mappers/sales-plan.mapper.ts), тот же приём, что уже
// применён у ShopAccountingPeriod.
// spec: shop/sales#requirement-план-на-период-неизменен-по-scope
export class ShopSalesPlan extends Entity<ShopSalesPlanProps> {
    declare protected readonly _id: AggregateID;

    static create(create: ShopSalesPlanCreateProps): ShopSalesPlan {
        const scope = ShopSalesPlanScope.create(
            create.department,
            create.category ?? null,
        );
        return new ShopSalesPlan({
            id: randomUUID(),
            props: {
                scope,
                period: create.period,
                turnover: create.turnover,
                margin: create.margin,
                orderTypeIds: create.orderTypeIds ?? [],
                source: create.source,
                status: 'CREATED',
                approval: null,
            },
        });
    }

    get department(): number {
        return this.props.scope.getDepartment();
    }

    get category(): string | null {
        return this.props.scope.getCategory();
    }

    get period(): string {
        return this.props.period;
    }

    get turnover(): number {
        return this.props.turnover;
    }

    get margin(): number {
        return this.props.margin;
    }

    // [] = "учитывать заказы всех типов" — как для строк, где выбор сделан
    // явно, так и для строк, созданных до появления этого поля.
    get orderTypeIds(): number[] {
        return this.props.orderTypeIds;
    }

    get source(): SalesPlanSource {
        return this.props.source;
    }

    get status(): SalesPlanStatus {
        return this.props.status;
    }

    get approvedBy(): number | null {
        return this.props.approval?.getApprovedBy() ?? null;
    }

    get approvedAt(): Date | null {
        return this.props.approval?.getApprovedAt() ?? null;
    }

    // spec: shop/sales#requirement-ручное-редактирование-плана-сбрасывает-утверждение
    edit(patch: ShopSalesPlanEditProps): void {
        if (patch.turnover !== undefined) {
            this.props.turnover = patch.turnover;
        }
        if (patch.margin !== undefined) {
            this.props.margin = patch.margin;
        }
        if (patch.orderTypeIds !== undefined) {
            this.props.orderTypeIds = patch.orderTypeIds;
        }
        this.props.source = 'MANUAL';
        if (this.props.status === 'APPROVED') {
            this.props.status = 'CREATED';
            this.props.approval = null;
        }
        this.validate();
    }

    // spec: shop/sales#requirement-утверждение-плана-идемпотентно
    approve(approvedBy: number): void {
        this.props.approval = ShopSalesPlanApproval.create(approvedBy);
        this.props.status = 'APPROVED';
    }

    validate(): void {
        if (this.props.turnover < 0) {
            throw new ArgumentInvalidException(
                'Плановый оборот не может быть отрицательным',
            );
        }
        if (this.props.margin < 0) {
            throw new ArgumentInvalidException(
                'Плановая маржа не может быть отрицательной',
            );
        }
        // Бросает ArgumentInvalidException при неверном формате периода —
        // сам объект Period здесь не нужен, только валидация формата.
        Period.create(this.props.period);
    }
}

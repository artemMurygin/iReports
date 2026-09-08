import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { SalesPlanScope } from '../value-objects/sales-plan-scope.value-object';
import { SalesPlanApproval } from '../value-objects/sales-plan-approval.value-object';
import {
    SalesPlanCreateProps,
    SalesPlanEditProps,
    SalesPlanProps,
    SalesDirection,
    SalesPlanSource,
    SalesPlanStatus,
} from '../types/sales-plan.types';

// План на конкретный месяц по отделу и, опционально, категории — вход для
// всех процентных зарплатных правил (Фаза 3, см.
// docs/payroll/plan-payroll-calculation.md).
//
// spec: service/sales#requirement-план-на-период-неизменен-по-scope
export class SalesPlan extends Entity<SalesPlanProps> {
    declare protected readonly _id: AggregateID;

    static create(create: SalesPlanCreateProps): SalesPlan {
        const scope = SalesPlanScope.create(
            create.direction,
            create.department,
            create.category ?? null,
        );
        return new SalesPlan({
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

    get direction(): SalesDirection {
        return this.props.scope.getDirection();
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

    // spec: service/sales#scenario-пустой-список-типов-заказов-означает-все-типы
    //
    // Значение по умолчанию для строк, созданных до появления этого поля
    // (@default([]) в sales.prisma, без разовой миграции данных).
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

    // spec: service/sales#requirement-ручное-редактирование-плана-сбрасывает-утверждение
    edit(patch: SalesPlanEditProps): void {
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

    // spec: service/sales#requirement-утверждение-плана-идемпотентно
    approve(approvedBy: number): void {
        this.props.approval = SalesPlanApproval.create(approvedBy);
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
        // spec: service/sales#requirement-валидация-числовых-значений-плана-и-шаблона
        //
        // Сам объект Period здесь не нужен, только валидация формата.
        Period.create(this.props.period);
    }
}

import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';

export interface ShopSalaryAccrualLineAdjustmentProps {
    previousAmount: number;
    newAmount: number;
    comment: string;
    adjustedBy: number;
}

// Зеркало domains/service/modules/accounting/domain/entities/
// salary-accrual-line-adjustment.entity.ts (Фаза 6
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop. Одна корректировка строки документа начисления:
// руководитель до проведения меняет действующую сумму строки с обязательным
// комментарием; previousAmount — действующая сумма на момент корректировки.
export class ShopSalaryAccrualLineAdjustment extends Entity<ShopSalaryAccrualLineAdjustmentProps> {
    declare protected readonly _id: AggregateID;

    static create(
        props: ShopSalaryAccrualLineAdjustmentProps,
    ): ShopSalaryAccrualLineAdjustment {
        return new ShopSalaryAccrualLineAdjustment({
            id: randomUUID(),
            props,
        });
    }

    get previousAmount(): number {
        return this.props.previousAmount;
    }

    get newAmount(): number {
        return this.props.newAmount;
    }

    get comment(): string {
        return this.props.comment;
    }

    get adjustedBy(): number {
        return this.props.adjustedBy;
    }

    validate(): void {
        if (
            !Number.isInteger(this.props.previousAmount) ||
            !Number.isInteger(this.props.newAmount)
        ) {
            throw new ArgumentInvalidException(
                'Суммы корректировки строки начисления должны быть целым числом рублей',
            );
        }
        if (!this.props.comment || this.props.comment.trim().length === 0) {
            throw new ArgumentNotProvidedException(
                'Корректировка строки начисления требует комментария',
            );
        }
        if (
            !Number.isInteger(this.props.adjustedBy) ||
            this.props.adjustedBy <= 0
        ) {
            throw new ArgumentInvalidException(
                'Корректировка строки начисления должна ссылаться на автора',
            );
        }
    }
}

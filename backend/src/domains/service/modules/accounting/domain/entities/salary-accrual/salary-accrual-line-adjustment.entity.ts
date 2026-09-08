import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';

export interface SalaryAccrualLineAdjustmentProps {
    previousAmount: number;
    newAmount: number;
    comment: string;
    adjustedBy: number;
}

// Одна корректировка строки документа начисления (PRD 2, Фаза 6):
// руководитель до проведения меняет действующую сумму строки с обязательным
// комментарием. История хранится целиком (каждая корректировка — отдельная
// запись), previousAmount — действующая сумма на момент корректировки (для
// первой корректировки равна originalAmount строки). Комментарий последней
// корректировки уходит в движение ACCRUAL_ADJUSTMENT при проведении.
export class SalaryAccrualLineAdjustment extends Entity<SalaryAccrualLineAdjustmentProps> {
    declare protected readonly _id: AggregateID;

    static create(
        props: SalaryAccrualLineAdjustmentProps,
    ): SalaryAccrualLineAdjustment {
        return new SalaryAccrualLineAdjustment({
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

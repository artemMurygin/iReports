import { randomUUID } from 'crypto';
import type { BalanceTransactionType } from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';
import { SalaryAccrual } from './salary-accrual.entity';
import { SalaryAccrualLine } from './salary-accrual-line.entity';

export type BalanceTransactionProps = {
    employeeId: number;
    direction: AccountingDirection;
    type: BalanceTransactionType;
    // Со знаком: приход положительный, расход отрицательный — остаток и
    // итоги считаются простой суммой (SUM ленты, PRD 2).
    amount: number;
    occurredAt: Date;
    createdBy: number;
    comment?: string;
    period?: string;
    accrualId?: string;
    lineId?: string;
    ruleId?: string;
    reversedTransactionId?: string;
    erpSyncRequired: boolean;
};

// Движение по балансу сотрудника (PRD 2 docs/payroll-closing-and-accrual/
// prd-salary-accrual-and-employee-balance.md) — запись ленты, единственного
// источника истины об остатке; хранимого поля «остаток» нет. Движение
// неизменяемо: у ленты нет PATCH/DELETE, ручные движения исправляются
// сторно (Фаза 7), а движения начисления удаляются только действием
// «Отменить начисление» строки документа — единственное исключение из
// неизменяемости (начисление до выплаты — черновик расчёта).
//
// Как и SalaryAccrual, сущность direction-агностична: направление — часть
// ключа баланса (employeeId, direction), а не ветка поведения; оба домена
// используют одну Prisma-реализацию порта под общим DI-токеном.
//
// Ссылки на источники (accrualId/lineId/ruleId/reversedTransactionId) —
// идентификаторы, а не копии: разбивка начисления в ленте резолвится на
// чтении из строки документа и не может с ней разойтись.
export class BalanceTransaction extends AggregateRoot<BalanceTransactionProps> {
    declare protected readonly _id: AggregateID;

    // Движения проведения строки документа — единственный легальный способ
    // положить начисление на баланс (PRD 2): SALARY_ACCRUAL на сумму
    // снапшота (originalAmount) и, если строка скорректирована,
    // ACCRUAL_ADJUSTMENT на разницу с комментарием корректировки — сумма
    // двух движений равна действующей сумме строки; нескорректированная
    // строка второго движения не создаёт.
    static forAccruedLine(
        accrual: SalaryAccrual,
        line: SalaryAccrualLine,
        accruedBy: number,
    ): BalanceTransaction[] {
        const base = {
            employeeId: accrual.employeeId,
            direction: accrual.direction,
            occurredAt: new Date(),
            createdBy: accruedBy,
            period: accrual.period,
            accrualId: accrual.id,
            lineId: line.id,
            ruleId: line.ruleId,
            erpSyncRequired: false,
        };
        const transactions = [
            new BalanceTransaction({
                id: randomUUID(),
                props: {
                    ...base,
                    type: 'SALARY_ACCRUAL',
                    amount: line.originalAmount,
                },
            }),
        ];
        const difference = line.amount - line.originalAmount;
        if (difference !== 0) {
            transactions.push(
                new BalanceTransaction({
                    id: randomUUID(),
                    props: {
                        ...base,
                        type: 'ACCRUAL_ADJUSTMENT',
                        amount: difference,
                        comment: line.adjustmentComment,
                    },
                }),
            );
        }
        return transactions;
    }

    get employeeId(): number {
        return this.props.employeeId;
    }

    get direction(): AccountingDirection {
        return this.props.direction;
    }

    get type(): BalanceTransactionType {
        return this.props.type;
    }

    get amount(): number {
        return this.props.amount;
    }

    get occurredAt(): Date {
        return this.props.occurredAt;
    }

    get createdBy(): number {
        return this.props.createdBy;
    }

    get comment(): string | undefined {
        return this.props.comment;
    }

    get period(): string | undefined {
        return this.props.period;
    }

    get accrualId(): string | undefined {
        return this.props.accrualId;
    }

    get lineId(): string | undefined {
        return this.props.lineId;
    }

    get ruleId(): string | undefined {
        return this.props.ruleId;
    }

    get reversedTransactionId(): string | undefined {
        return this.props.reversedTransactionId;
    }

    get erpSyncRequired(): boolean {
        return this.props.erpSyncRequired;
    }

    validate(): void {
        const direction: string = this.props.direction;
        if (direction !== 'service' && direction !== 'shop') {
            throw new ArgumentInvalidException(
                `Недопустимое направление движения баланса: "${direction}"`,
            );
        }
        if (
            !Number.isInteger(this.props.employeeId) ||
            this.props.employeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Движение баланса должно ссылаться на сотрудника',
            );
        }
        if (!Number.isInteger(this.props.amount)) {
            throw new ArgumentInvalidException(
                'Сумма движения баланса должна быть целым числом рублей',
            );
        }
        if (
            !Number.isInteger(this.props.createdBy) ||
            this.props.createdBy <= 0
        ) {
            throw new ArgumentInvalidException(
                'Движение баланса должно ссылаться на автора',
            );
        }
        if (this.props.type === 'ACCRUAL_ADJUSTMENT') {
            // Разница 0 движения не порождает (см. forAccruedLine), а
            // комментарий обязателен — он и объясняет сотруднику, на
            // сколько и почему руководитель изменил расчёт системы.
            if (this.props.amount === 0) {
                throw new ArgumentInvalidException(
                    'Движение корректировки начисления не может быть нулевым',
                );
            }
            if (!this.props.comment || this.props.comment.trim().length === 0) {
                throw new ArgumentNotProvidedException(
                    'Движение корректировки начисления требует комментария',
                );
            }
        }
        if (
            (this.props.type === 'SALARY_ACCRUAL' ||
                this.props.type === 'ACCRUAL_ADJUSTMENT') &&
            (!this.props.accrualId || !this.props.lineId || !this.props.ruleId)
        ) {
            throw new ArgumentInvalidException(
                'Движение начисления должно ссылаться на документ, строку и правило',
            );
        }
    }
}

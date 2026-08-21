import { randomUUID } from 'crypto';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import {
    SalaryAccrualLine,
    SalaryAccrualSourceLine,
} from './salary-accrual-line.entity';

export type SalaryAccrualProps = {
    direction: AccountingDirection;
    period: Period;
    employeeId: number;
    status: SalaryAccrualStatus;
    isDismissed: boolean;
    total: number;
    lines: SalaryAccrualLine[];
};

export type SalaryAccrualCreateProps = {
    direction: AccountingDirection;
    period: string;
    employeeId: number;
    isDismissed: boolean;
    total: number;
    lines: SalaryAccrualSourceLine[];
};

// Документ начисления зарплаты сотрудника за закрытый период (PRD 1
// docs/payroll-closing-and-accrual/prd-accounting-period-closing-pipeline.md,
// "Документ начисления (SalaryAccrual)"). Рождается только закрытием
// расчётного периода — один документ на (direction, period, employeeId),
// уникальность обеспечивает БД (@@unique в salary-accrual.prisma), строки
// повторяют RuleBreakdownLine снапшота один в один, total равен total
// снапшота (инвариант проверяется в validate()).
//
// Как и AccountingPeriod, сущность direction-агностична: направление — часть
// естественного ключа, а не ветка поведения; её переиспользуют оба
// независимых хендлера закрытия (CloseAccountingPeriodHandler и
// CloseShopAccountingPeriodHandler) — общая абстракция, а не
// service-специфичная бизнес-логика (см. шапку
// close-shop-accounting-period.handler.ts).
//
// В PRD 1 документ и все его строки всегда DRAFT; переходы
// PARTIALLY_ACCRUED/ACCRUED (проведение строк на баланс) — PRD 2, PAID —
// PRD 3. isDismissed фиксируется на момент закрытия по активности
// BitrixEmployee и на чтении не пересчитывается.
export class SalaryAccrual extends AggregateRoot<SalaryAccrualProps> {
    declare protected readonly _id: AggregateID;

    static createFromSnapshot(create: SalaryAccrualCreateProps): SalaryAccrual {
        return new SalaryAccrual({
            id: randomUUID(),
            props: {
                direction: create.direction,
                period: Period.create(create.period),
                employeeId: create.employeeId,
                status: 'DRAFT',
                isDismissed: create.isDismissed,
                total: create.total,
                lines: create.lines.map((line, index) =>
                    SalaryAccrualLine.fromBreakdownLine(line, index),
                ),
            },
        });
    }

    get direction(): AccountingDirection {
        return this.props.direction;
    }

    get period(): string {
        return this.props.period.getValue();
    }

    get employeeId(): number {
        return this.props.employeeId;
    }

    get status(): SalaryAccrualStatus {
        return this.props.status;
    }

    get isDismissed(): boolean {
        return this.props.isDismissed;
    }

    get total(): number {
        return this.props.total;
    }

    get lines(): SalaryAccrualLine[] {
        return this.props.lines;
    }

    isDraft(): boolean {
        return this.props.status === 'DRAFT';
    }

    validate(): void {
        const direction: string = this.props.direction;
        if (direction !== 'service' && direction !== 'shop') {
            throw new ArgumentInvalidException(
                `Недопустимое направление документа начисления: "${direction}"`,
            );
        }
        if (
            !Number.isInteger(this.props.employeeId) ||
            this.props.employeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Документ начисления должен ссылаться на сотрудника',
            );
        }
        if (!Number.isInteger(this.props.total)) {
            throw new ArgumentInvalidException(
                'Сумма документа начисления должна быть целым числом рублей',
            );
        }
        // Сумма документа = total снапшота = сумма исходных сумм строк
        // (PeriodCalculationOrchestrator.total) — расхождение означает, что
        // документ собран не из того снапшота, из которого взяты строки.
        // Сравнение с originalAmount, а не amount: корректировка строки
        // (PRD 2) меняет действующую сумму, но не след исходного расчёта.
        const linesTotal = this.props.lines.reduce(
            (sum, line) => sum + line.originalAmount,
            0,
        );
        if (linesTotal !== this.props.total) {
            throw new ArgumentInvalidException(
                `Сумма документа начисления (${this.props.total}) не равна сумме его строк (${linesTotal})`,
            );
        }
    }
}

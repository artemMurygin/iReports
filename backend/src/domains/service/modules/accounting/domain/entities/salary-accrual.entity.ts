import { randomUUID } from 'crypto';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import {
    SalaryAccrualLineNotFoundException,
    SalaryAccrualPaidException,
} from '../exceptions/salary-accrual.exception';
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
// Статус документа — производная от статусов строк (PRD 2, Фаза 6):
// DRAFT — ни одна строка не проведена, PARTIALLY_ACCRUED — часть,
// ACCRUED — все («ожидает выплаты»); пересчитывается после каждого
// проведения/отмены (recalculateStatus). PAID выставляет выплата (PRD 3) и
// блокирует любые действия над строками. isDismissed фиксируется на момент
// закрытия по активности BitrixEmployee и на чтении не пересчитывается.
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

    isPaid(): boolean {
        return this.props.status === 'PAID';
    }

    // Число уже проведённых строк — прогресс «N из M» для списка
    // (accruedLinesCount в контракте).
    get accruedLinesCount(): number {
        return this.props.lines.filter((line) => line.isAccrued()).length;
    }

    getLine(lineId: string): SalaryAccrualLine {
        const line = this.props.lines.find((item) => item.id === lineId);
        if (!line) {
            throw new SalaryAccrualLineNotFoundException(this.id, lineId);
        }
        return line;
    }

    // Проведение строки (PRD 2): строка переходит в ACCRUED, статус
    // документа пересчитывается. Сами движения баланса создаёт хендлер
    // (BalanceTransaction.forAccruedLine) в одной транзакции с сохранением
    // документа. Для выплаченного документа действия запрещены целиком.
    accrueLine(lineId: string): SalaryAccrualLine {
        this.ensureNotPaid();
        const line = this.getLine(lineId);
        line.markAccrued();
        this.recalculateStatus();
        return line;
    }

    // Отмена начисления (PRD 2): строка возвращается в DRAFT (её движения
    // хендлер удаляет с баланса без следа: начисление до выплаты —
    // черновик расчёта, а не факт движения денег). Запрещена для PAID.
    unaccrueLine(lineId: string): SalaryAccrualLine {
        this.ensureNotPaid();
        const line = this.getLine(lineId);
        line.revertToDraft();
        this.recalculateStatus();
        return line;
    }

    // Корректировка строки (PRD 2): только до проведения, обязательный
    // комментарий; originalAmount строки не меняется, инвариант
    // total = Σ originalAmount (см. validate()) корректировкой не задевается.
    adjustLine(
        lineId: string,
        newAmount: number,
        comment: string,
        adjustedBy: number,
    ): SalaryAccrualLine {
        this.ensureNotPaid();
        const line = this.getLine(lineId);
        line.adjust(newAmount, comment, adjustedBy);
        return line;
    }

    private ensureNotPaid(): void {
        if (this.isPaid()) {
            throw new SalaryAccrualPaidException(this.id);
        }
    }

    // Статус документа — производная от строк: DRAFT / PARTIALLY_ACCRUED /
    // ACCRUED. PAID сюда не попадает — его выставляет выплата (PRD 3), а
    // все переходы строк для PAID заблокированы ensureNotPaid().
    private recalculateStatus(): void {
        const accrued = this.accruedLinesCount;
        if (accrued === 0) {
            this.props.status = 'DRAFT';
        } else if (accrued === this.props.lines.length) {
            this.props.status = 'ACCRUED';
        } else {
            this.props.status = 'PARTIALLY_ACCRUED';
        }
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

import { randomUUID } from 'crypto';
import type { SalaryAccrualStatus } from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import { Period } from '@/shared/domain/period.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import {
    ShopSalaryAccrualLineNotFoundException,
    ShopSalaryAccrualNotAccruedException,
    ShopSalaryAccrualNotPaidException,
    ShopSalaryAccrualPaidException,
} from '../exceptions/shop-salary-accrual.exception';
import {
    ShopSalaryAccrualLine,
    ShopSalaryAccrualSourceLine,
} from './shop-salary-accrual-line.entity';

export type ShopSalaryAccrualProps = {
    period: Period;
    employeeId: number;
    status: SalaryAccrualStatus;
    isDismissed: boolean;
    total: number;
    lines: ShopSalaryAccrualLine[];
};

export type ShopSalaryAccrualCreateProps = {
    period: string;
    employeeId: number;
    isDismissed: boolean;
    total: number;
    lines: ShopSalaryAccrualSourceLine[];
};

// Зеркало domains/service/modules/accounting/domain/entities/
// salary-accrual.entity.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. В отличие от сервисной сущности
// здесь нет поля `direction` в props: направление зафиксировано самим
// расположением класса в домене shop (инфраструктурный слой —
// ShopSalaryAccrualRepository — подставляет `direction: 'shop'` при работе
// с общей Prisma-таблицей salary_accruals, см. shop-salary-accrual.mapper.ts),
// тот же приём, что уже применён у ShopAccountingPeriod (Фаза 5). Геттер
// `direction` ниже — производный (всегда 'shop'), а не хранимое поле: он
// нужен только для структурной совместимости с сквозным модулем
// employee-balance (BalanceTransaction.forAccruedLine), который остаётся
// generic по направлению и принимает любую сущность с такой формой (см. WHY
// в balance-transaction.entity.ts) — не для ветвления поведения внутри
// самой сущности.
//
// Документ начисления зарплаты сотрудника за закрытый период (PRD 1
// docs/payroll-closing-and-accrual/prd-accounting-period-closing-pipeline.md).
// Рождается только закрытием расчётного периода направления shop — один
// документ на (period, employeeId), уникальность обеспечивает БД (общий
// @@unique(direction, period, employeeId) в salary-accrual.prisma, здесь
// direction всегда 'shop'), строки повторяют RuleBreakdownLine снапшота
// один в один, total равен total снапшота (инвариант проверяется в
// validate()).
//
// Статус документа — производная от статусов строк (PRD 2, Фаза 6):
// DRAFT — ни одна строка не проведена, PARTIALLY_ACCRUED — часть,
// ACCRUED — все («ожидает выплаты»); пересчитывается после каждого
// проведения/отмены (recalculateStatus). PAID выставляет выплата (PRD 3) и
// блокирует любые действия над строками. isDismissed фиксируется на момент
// закрытия по активности BitrixEmployee и на чтении не пересчитывается.
export class ShopSalaryAccrual extends AggregateRoot<ShopSalaryAccrualProps> {
    declare protected readonly _id: AggregateID;

    static createFromSnapshot(
        create: ShopSalaryAccrualCreateProps,
    ): ShopSalaryAccrual {
        return new ShopSalaryAccrual({
            id: randomUUID(),
            props: {
                period: Period.create(create.period),
                employeeId: create.employeeId,
                status: 'DRAFT',
                isDismissed: create.isDismissed,
                total: create.total,
                lines: create.lines.map((line, index) =>
                    ShopSalaryAccrualLine.fromBreakdownLine(line, index),
                ),
            },
        });
    }

    // Производный, всегда 'shop' — см. WHY в шапке файла.
    get direction(): AccountingDirection {
        return 'shop';
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

    get lines(): ShopSalaryAccrualLine[] {
        return this.props.lines;
    }

    isDraft(): boolean {
        return this.props.status === 'DRAFT';
    }

    isPaid(): boolean {
        return this.props.status === 'PAID';
    }

    get accruedLinesCount(): number {
        return this.props.lines.filter((line) => line.isAccrued()).length;
    }

    getLine(lineId: string): ShopSalaryAccrualLine {
        const line = this.props.lines.find((item) => item.id === lineId);
        if (!line) {
            throw new ShopSalaryAccrualLineNotFoundException(this.id, lineId);
        }
        return line;
    }

    accrueLine(lineId: string): ShopSalaryAccrualLine {
        this.ensureNotPaid();
        const line = this.getLine(lineId);
        line.markAccrued();
        this.recalculateStatus();
        return line;
    }

    unaccrueLine(lineId: string): ShopSalaryAccrualLine {
        this.ensureNotPaid();
        const line = this.getLine(lineId);
        line.revertToDraft();
        this.recalculateStatus();
        return line;
    }

    adjustLine(
        lineId: string,
        newAmount: number,
        comment: string,
        adjustedBy: number,
    ): ShopSalaryAccrualLine {
        this.ensureNotPaid();
        const line = this.getLine(lineId);
        line.adjust(newAmount, comment, adjustedBy);
        return line;
    }

    private ensureNotPaid(): void {
        if (this.isPaid()) {
            throw new ShopSalaryAccrualPaidException(this.id);
        }
    }

    // Выплата (PRD 3) — только из ACCRUED, см. WHY на аналогичном методе
    // сервисной сущности: только документы СВОЕГО направления переходят в
    // PAID от операции выплаты shop (изоляция доменов service/shop,
    // backend/CLAUDE.md) — не баг, осознанный компромисс PRD 3.
    markPaid(): void {
        if (this.props.status !== 'ACCRUED') {
            throw new ShopSalaryAccrualNotAccruedException(this.id);
        }
        for (const line of this.props.lines) {
            line.markPaid();
        }
        this.props.status = 'PAID';
    }

    revertToAccrued(): void {
        if (!this.isPaid()) {
            throw new ShopSalaryAccrualNotPaidException(this.id);
        }
        for (const line of this.props.lines) {
            line.revertToAccrued();
        }
        this.recalculateStatus();
    }

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

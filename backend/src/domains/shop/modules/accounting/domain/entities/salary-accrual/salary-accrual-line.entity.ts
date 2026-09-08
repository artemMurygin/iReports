import { randomUUID } from 'crypto';
import type { SalaryAccrualLineStatus } from 'ireports-contracts';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { CalculationSourceRef } from '@/shared/domain/calculation-line';
import { ArgumentNotProvidedException } from '@/shared/exceptions';
import {
    ShopSalaryAccrualLineAlreadyAccruedException,
    ShopSalaryAccrualLineManualInputNotRequiredException,
    ShopSalaryAccrualLineNotAccruedException,
    ShopSalaryAccrualLineNotDraftException,
    ShopSalaryAccrualLineNotPaidException,
} from '../../exceptions/salary-accrual.exception';
import { ShopSalaryAccrualLineAdjustment } from './salary-accrual-line-adjustment.entity';

// Зеркало domains/service/modules/accounting/domain/entities/
// salary-accrual-line.entity.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Строка документа начисления —
// одна на зарплатное правило из разбивки снапшота, повторяет
// RuleBreakdownLine один в один. originalAmount — сумма из снапшота на
// момент закрытия, amount — действующая сумма строки; корректировка меняет
// только amount, originalAmount остаётся следом исходного расчёта.
export interface ShopSalaryAccrualSourceLine {
    ruleId: string;
    type: string;
    name: string;
    targetRole: string;
    salaryBasis?: string;
    quantity?: number;
    rate?: number;
    amount: number;
    sources: CalculationSourceRef[];
    // Раздел 18 tasks.md (add-task-based-salary-rule) — зеркалит
    // requiresManualInput сервисного SalaryAccrualSourceLine (см. WHY там):
    // проброс RuleBreakdownLine.requiresManualInput в
    // ShopSalaryAccrualLineProps/fromBreakdownLine.
    requiresManualInput?: boolean;
}

export interface ShopSalaryAccrualLineProps {
    position: number;
    ruleId: string;
    type: string;
    name: string;
    targetRole: string;
    salaryBasis?: string;
    quantity?: number;
    rate?: number;
    originalAmount: number;
    amount: number;
    sources: CalculationSourceRef[];
    status: SalaryAccrualLineStatus;
    adjustments: ShopSalaryAccrualLineAdjustment[];
    // Раздел 18 tasks.md (add-task-based-salary-rule, design.md Decision 5,
    // зеркало domains/service/.../salary-accrual-line.entity.ts) — первичный
    // комментарий руководителя при ручном вводе суммы строки TaskCompletion
    // (НЕ история корректировок уже проведённой суммы — adjustments/
    // adjustmentComment выше) и флаг «строка ждёт ручного ввода». Optional —
    // существующие конструкторы ShopSalaryAccrualLine (прочие типы правил) не
    // обязаны их указывать.
    comment?: string | null;
    requiresManualInput?: boolean;
}

export class ShopSalaryAccrualLine extends Entity<ShopSalaryAccrualLineProps> {
    declare protected readonly _id: AggregateID;

    static fromBreakdownLine(
        line: ShopSalaryAccrualSourceLine,
        position: number,
    ): ShopSalaryAccrualLine {
        return new ShopSalaryAccrualLine({
            id: randomUUID(),
            props: {
                position,
                ruleId: line.ruleId,
                type: line.type,
                name: line.name,
                targetRole: line.targetRole,
                salaryBasis: line.salaryBasis,
                quantity: line.quantity,
                rate: line.rate,
                originalAmount: line.amount,
                amount: line.amount,
                sources: line.sources,
                status: 'DRAFT',
                adjustments: [],
                comment: null,
                requiresManualInput: line.requiresManualInput ?? false,
            },
        });
    }

    get position(): number {
        return this.props.position;
    }

    get ruleId(): string {
        return this.props.ruleId;
    }

    get type(): string {
        return this.props.type;
    }

    get name(): string {
        return this.props.name;
    }

    get targetRole(): string {
        return this.props.targetRole;
    }

    get salaryBasis(): string | undefined {
        return this.props.salaryBasis;
    }

    get quantity(): number | undefined {
        return this.props.quantity;
    }

    get rate(): number | undefined {
        return this.props.rate;
    }

    get originalAmount(): number {
        return this.props.originalAmount;
    }

    get amount(): number {
        return this.props.amount;
    }

    get sources(): CalculationSourceRef[] {
        return this.props.sources;
    }

    get status(): SalaryAccrualLineStatus {
        return this.props.status;
    }

    get adjustments(): ShopSalaryAccrualLineAdjustment[] {
        return this.props.adjustments;
    }

    // Первичный комментарий руководителя (setManualReward) — не путать с
    // adjustmentComment (последняя корректировка уже проведённой суммы).
    get comment(): string | null {
        return this.props.comment ?? null;
    }

    // Строка ждёт ручного ввода суммы (TaskCompletion, design.md Decision 5)
    // — true сразу после fromBreakdownLine, сбрасывается setManualReward().
    get requiresManualInput(): boolean {
        return this.props.requiresManualInput ?? false;
    }

    isDraft(): boolean {
        return this.props.status === 'DRAFT';
    }

    isAccrued(): boolean {
        return this.props.status !== 'DRAFT';
    }

    isAdjusted(): boolean {
        return this.props.amount !== this.props.originalAmount;
    }

    get adjustmentComment(): string | undefined {
        const last = this.props.adjustments[this.props.adjustments.length - 1];
        return last?.comment;
    }

    adjust(newAmount: number, comment: string, adjustedBy: number): void {
        if (!this.isDraft()) {
            throw new ShopSalaryAccrualLineNotDraftException(this.id);
        }
        if (!Number.isInteger(newAmount)) {
            throw new ArgumentInvalidException(
                'Сумма корректировки строки начисления должна быть целым числом рублей',
            );
        }
        const adjustment = ShopSalaryAccrualLineAdjustment.create({
            previousAmount: this.props.amount,
            newAmount,
            comment,
            adjustedBy,
        });
        this.props.adjustments.push(adjustment);
        this.props.amount = newAmount;
    }

    // Первичный ручной ввод суммы+комментария (раздел 18 tasks.md, design.md
    // Decision 5, зеркало domains/service/.../salary-accrual-line.entity.ts
    // setManualReward) — только для строки, которую оркестратор расчёта
    // пометил requiresManualInput (TaskCompletion, ещё не введено), и только
    // до проведения. В отличие от adjust(): не история корректировок
    // (ShopSalaryAccrualLineAdjustment) — первичный ввод, а не изменение уже
    // посчитанного значения; нет отдельного "автора" в контракте
    // (setTaskCompletionLineRewardRequestSchema — только amount/comment) — в
    // отличие от adjustedBy у adjust().
    setManualReward(amount: number, comment: string): void {
        if (!this.requiresManualInput) {
            throw new ShopSalaryAccrualLineManualInputNotRequiredException(
                this.id,
            );
        }
        if (!this.isDraft()) {
            throw new ShopSalaryAccrualLineNotDraftException(this.id);
        }
        if (!Number.isInteger(amount)) {
            throw new ArgumentInvalidException(
                'Сумма начисления по правилу «за выполнение задачи» должна быть целым числом рублей',
            );
        }
        if (!comment || comment.trim().length === 0) {
            throw new ArgumentNotProvidedException(
                'Начисление по правилу «за выполнение задачи» требует комментария',
            );
        }
        this.props.amount = amount;
        this.props.comment = comment;
        this.props.requiresManualInput = false;
    }

    markAccrued(): void {
        if (!this.isDraft()) {
            throw new ShopSalaryAccrualLineAlreadyAccruedException(this.id);
        }
        this.props.status = 'ACCRUED';
    }

    revertToDraft(): void {
        if (this.props.status !== 'ACCRUED') {
            throw new ShopSalaryAccrualLineNotAccruedException(this.id);
        }
        this.props.status = 'DRAFT';
    }

    markPaid(): void {
        if (this.props.status !== 'ACCRUED') {
            throw new ShopSalaryAccrualLineNotAccruedException(this.id);
        }
        this.props.status = 'PAID';
    }

    revertToAccrued(): void {
        if (this.props.status !== 'PAID') {
            throw new ShopSalaryAccrualLineNotPaidException(this.id);
        }
        this.props.status = 'ACCRUED';
    }

    validate(): void {
        if (!this.props.ruleId) {
            throw new ArgumentInvalidException(
                'Строка документа начисления должна ссылаться на зарплатное правило',
            );
        }
        if (
            !Number.isInteger(this.props.amount) ||
            !Number.isInteger(this.props.originalAmount)
        ) {
            throw new ArgumentInvalidException(
                'Сумма строки документа начисления должна быть целым числом рублей',
            );
        }
        if (!Number.isInteger(this.props.position) || this.props.position < 0) {
            throw new ArgumentInvalidException(
                'Позиция строки документа начисления должна быть неотрицательным целым',
            );
        }
    }
}

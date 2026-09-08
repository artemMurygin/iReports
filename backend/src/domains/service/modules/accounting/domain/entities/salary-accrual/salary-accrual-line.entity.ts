import { randomUUID } from 'crypto';
import type { SalaryAccrualLineStatus } from 'ireports-contracts';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { CalculationSourceRef } from '@/shared/domain/calculation-line';
import { ArgumentNotProvidedException } from '@/shared/exceptions';
import {
    SalaryAccrualLineAlreadyAccruedException,
    SalaryAccrualLineManualInputNotRequiredException,
    SalaryAccrualLineNotAccruedException,
    SalaryAccrualLineNotDraftException,
    SalaryAccrualLineNotPaidException,
} from '../../exceptions/salary-accrual.exception';
import { SalaryAccrualLineAdjustment } from './salary-accrual-line-adjustment.entity';

// Строка документа начисления — одна на зарплатное правило из разбивки
// снапшота (PRD 1 docs/payroll-closing-and-accrual, "Документ начисления"):
// повторяет RuleBreakdownLine один в один, но хранится нормализованно
// (отдельная таблица), потому что в PRD 2 строка становится самостоятельным
// объектом с собственным статусом и движением по балансу.
//
// originalAmount — сумма из снапшота на момент закрытия, amount — действующая
// сумма строки. В PRD 1 они всегда равны; корректировка с обязательным
// комментарием (PRD 2) меняет только amount, originalAmount остаётся как
// след исходного расчёта.
//
// targetRole — string, а не TargetRole сервиса: сущность direction-агностична
// (строка магазина несёт роли shop — ONLINE_MANAGER/OFFLINE_PURCHASER и т.п.),
// перечень ролей валидирует контракт (targetRoleSchema) на границе HTTP.
// Вход фабрики — структурная форма RuleBreakdownLine обоих направлений
// (service и shop держат по своему builder'у с собственным union ролей), а
// не импорт типа одного из доменов: сущность общая и не должна знать, чей
// именно builder собрал строку.
export interface SalaryAccrualSourceLine {
    ruleId: string;
    type: string;
    name: string;
    targetRole: string;
    salaryBasis?: string;
    quantity?: number;
    rate?: number;
    amount: number;
    sources: CalculationSourceRef[];
    // Раздел 10 tasks.md (add-task-based-salary-rule) — зеркалит
    // RuleBreakdownLine.requiresManualInput (см. rule-breakdown.builder.ts).
    // Проброс этого значения в SalaryAccrualLineProps/fromBreakdownLine —
    // раздел 13 (ручной ввод суммы начисления), здесь только форма входа.
    requiresManualInput?: boolean;
}

export interface SalaryAccrualLineProps {
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
    // История корректировок (PRD 2, Фаза 6) — каждая корректировка до
    // проведения добавляет запись; действующая сумма — amount, исходная —
    // originalAmount (никогда не меняется).
    adjustments: SalaryAccrualLineAdjustment[];
    // Раздел 13 tasks.md (add-task-based-salary-rule, design.md Decision 5) —
    // первичный комментарий руководителя при ручном вводе суммы строки типа
    // TaskCompletion (НЕ история корректировок уже проведённой суммы — это
    // adjustments/adjustmentComment выше) и флаг «строка ждёт ручного ввода».
    // Optional — существующие конструкторы SalaryAccrualLine (прочие типы
    // правил, старые тесты) не обязаны их указывать: getComment()/
    // requiresManualInput трактуют отсутствие как «не задан»/false.
    comment?: string | null;
    requiresManualInput?: boolean;
}

export class SalaryAccrualLine extends Entity<SalaryAccrualLineProps> {
    declare protected readonly _id: AggregateID;

    // Фабрика из строки снапшота — единственный легальный способ завести
    // строку документа при закрытии периода: amount === originalAmount,
    // статус DRAFT.
    static fromBreakdownLine(
        line: SalaryAccrualSourceLine,
        position: number,
    ): SalaryAccrualLine {
        return new SalaryAccrualLine({
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

    get adjustments(): SalaryAccrualLineAdjustment[] {
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

    // Скорректирована ли строка: действующая сумма разошлась с исходной.
    // Проведение такой строки создаёт два движения — SALARY_ACCRUAL на
    // originalAmount и ACCRUAL_ADJUSTMENT на разницу (PRD 2).
    isAdjusted(): boolean {
        return this.props.amount !== this.props.originalAmount;
    }

    // Комментарий последней корректировки — уходит в движение
    // ACCRUAL_ADJUSTMENT при проведении и показывается в UI рядом с
    // зачёркнутой исходной суммой.
    get adjustmentComment(): string | undefined {
        const last = this.props.adjustments[this.props.adjustments.length - 1];
        return last?.comment;
    }

    // Корректировка до проведения (PRD 2): только DRAFT, обязательный
    // комментарий (валидируется самой записью корректировки), originalAmount
    // не меняется. Скорректировать обратно в исходную сумму тоже можно —
    // тогда при проведении ACCRUAL_ADJUSTMENT не создастся (разница 0), но
    // история корректировок сохранит след.
    adjust(newAmount: number, comment: string, adjustedBy: number): void {
        if (!this.isDraft()) {
            throw new SalaryAccrualLineNotDraftException(this.id);
        }
        if (!Number.isInteger(newAmount)) {
            throw new ArgumentInvalidException(
                'Сумма корректировки строки начисления должна быть целым числом рублей',
            );
        }
        const adjustment = SalaryAccrualLineAdjustment.create({
            previousAmount: this.props.amount,
            newAmount,
            comment,
            adjustedBy,
        });
        this.props.adjustments.push(adjustment);
        this.props.amount = newAmount;
    }

    // Первичный ручной ввод суммы+комментария (раздел 13 tasks.md,
    // design.md Decision 5) — только для строки, которую оркестратор
    // расчёта пометил requiresManualInput (TaskCompletion, ещё не введено),
    // и только до проведения. В отличие от adjust(): не история
    // корректировок (SalaryAccrualLineAdjustment) — первичный ввод, а не
    // изменение уже посчитанного значения; нет отдельного "автора" в
    // контракте (setTaskCompletionLineRewardRequestSchema — только
    // amount/comment, см. комментарий в contracts/commands/salary-accrual.ts)
    // — в отличие от adjustedBy у adjust().
    //
    // spec: service/accounting#requirement-комментарий-обязателен-и-виден-сотруднику
    setManualReward(amount: number, comment: string): void {
        if (!this.requiresManualInput) {
            throw new SalaryAccrualLineManualInputNotRequiredException(this.id);
        }
        if (!this.isDraft()) {
            throw new SalaryAccrualLineNotDraftException(this.id);
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

    // Проведение строки на баланс — переход DRAFT → ACCRUED. Повторное
    // проведение конфликтует здесь, а гонку параллельных запросов
    // останавливает уникальный индекс БД (см. BalanceTransactionRepository).
    markAccrued(): void {
        if (!this.isDraft()) {
            throw new SalaryAccrualLineAlreadyAccruedException(this.id);
        }
        this.props.status = 'ACCRUED';
    }

    // Отмена начисления — обратный переход ACCRUED → DRAFT (движения строки
    // при этом удаляются с баланса, см. UnaccrueSalaryAccrualLineHandler);
    // строка снова доступна для корректировки и проведения.
    revertToDraft(): void {
        if (this.props.status !== 'ACCRUED') {
            throw new SalaryAccrualLineNotAccruedException(this.id);
        }
        this.props.status = 'DRAFT';
    }

    // Выплата (PRD 3 docs/payroll-closing-and-accrual/
    // prd-salary-payout-and-erp-cash-documents.md) — переход ACCRUED → PAID,
    // вызывается только на строках уже выплаченного (SalaryAccrual.markPaid())
    // документа: к моменту вызова markPaid() на документе все его строки уже
    // ACCRUED (см. SalaryAccrual.recalculateStatus — статус ACCRUED
    // достигается, только когда accruedLinesCount === lines.length),
    // повторяем ту же проверку и здесь как защиту инварианта.
    markPaid(): void {
        if (this.props.status !== 'ACCRUED') {
            throw new SalaryAccrualLineNotAccruedException(this.id);
        }
        this.props.status = 'PAID';
    }

    // Удаление выплаты (PRD 3: «возврат документов начисления из PAID в
    // ACCRUED») — обратный переход PAID → ACCRUED.
    revertToAccrued(): void {
        if (this.props.status !== 'PAID') {
            throw new SalaryAccrualLineNotPaidException(this.id);
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

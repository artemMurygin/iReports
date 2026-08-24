import { randomUUID } from 'crypto';
import type { SalaryAccrualLineStatus } from 'ireports-contracts';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { CalculationSourceRef } from '@/shared/domain/calculation-line';
import {
    SalaryAccrualLineAlreadyAccruedException,
    SalaryAccrualLineNotAccruedException,
    SalaryAccrualLineNotDraftException,
    SalaryAccrualLineNotPaidException,
} from '../exceptions/salary-accrual.exception';
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

import { randomUUID } from 'crypto';
import type { SalaryAccrualLineStatus } from 'ireports-contracts';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { CalculationSourceRef } from '@/shared/domain/calculation-line';

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

    isDraft(): boolean {
        return this.props.status === 'DRAFT';
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

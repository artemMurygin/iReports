import { randomUUID } from 'crypto';
import type {
    BalanceTransactionType,
    ManualBalanceTransactionType,
} from 'ireports-contracts';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { AggregateID } from '@/shared/domain/entity.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';
import { BalanceTransactionNotDeletableException } from '../exceptions/balance-transaction.exception';
import { SalaryAccrual } from './salary-accrual.entity';
import { SalaryAccrualLine } from './salary-accrual-line.entity';

// Знак ручного движения определяется типом (PRD 2, таблица типов): клиент
// передаёт абсолютную величину, сущность подставляет знак. ADJUSTMENT в
// перечнях ниже отсутствует — его знак задаётся явно (amount со знаком).
const MANUAL_OUTFLOW_TYPES: ReadonlySet<ManualBalanceTransactionType> = new Set(
    ['ADVANCE', 'EXTRA_ADVANCE', 'PENALTY'],
);
const MANUAL_INFLOW_TYPES: ReadonlySet<ManualBalanceTransactionType> = new Set([
    'BONUS',
    'SICK_LEAVE',
    'VACATION_PAY',
]);
const MANUAL_TYPES: ReadonlySet<BalanceTransactionType> = new Set([
    ...MANUAL_OUTFLOW_TYPES,
    ...MANUAL_INFLOW_TYPES,
    'ADJUSTMENT',
]);
// Типы с обязательным комментарием: у штрафа и корректировки сотрудник
// должен видеть причину.
const COMMENT_REQUIRED_TYPES: ReadonlySet<BalanceTransactionType> = new Set([
    'PENALTY',
    'ADJUSTMENT',
]);

export type CreateManualBalanceTransactionProps = {
    employeeId: number;
    direction: AccountingDirection;
    type: ManualBalanceTransactionType;
    // Для типов со знаком по типу — абсолютная величина (> 0), для
    // ADJUSTMENT — со знаком (≠ 0), знак задаётся явно.
    amount: number;
    occurredAt?: Date;
    createdBy: number;
    comment?: string;
    period?: string;
    erpSyncRequired?: boolean;
};

// Выплата (PRD 3 docs/payroll-closing-and-accrual/
// prd-salary-payout-and-erp-cash-documents.md): amount — абсолютная
// величина (> 0, «Создаётся на любую сумму amount > 0»), знак подставляет
// сама сущность (расход, как и у ручных outflow-типов) — тот же приём, что
// у createManual. direction — направление кассы ERP, в которую уйдёт
// расходный документ (страница выплаты конкретного направления); баланс,
// который эта сумма уменьшает, общий по сотруднику (PRD 2) — direction
// здесь ТОЛЬКО атрибут происхождения, не фильтр остатка.
export type CreatePayoutProps = {
    employeeId: number;
    direction: AccountingDirection;
    amount: number;
    createdBy: number;
    comment?: string;
    occurredAt?: Date;
};

export type BalanceTransactionProps = {
    employeeId: number;
    // Атрибут происхождения движения (документ какого направления его
    // породил / в какую кассу ERP уйдёт выплата — PRD 3). Баланс ОБЩИЙ по
    // сотруднику (Фаза 8b): на остаток и группировку direction не влияет.
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
    erpSyncRequired: boolean;
};

// Движение по балансу сотрудника (PRD 2 docs/payroll-closing-and-accrual/
// prd-salary-accrual-and-employee-balance.md) — запись ленты, единственного
// источника истины об остатке; хранимого поля «остаток» нет. У ленты нет
// PATCH: ошибочное ручное движение без документа ERP руководитель УДАЛЯЕТ
// (Фаза 8b, см. ensureDeletable), движения начисления удаляются только
// действием «Отменить начисление» строки документа, движения с документом
// ERP — вместе с документом ERP (PRD 3).
//
// Как и SalaryAccrual, сущность direction-агностична: направление — лишь
// атрибут происхождения движения, а не ветка поведения; оба домена
// используют одну Prisma-реализацию порта под общим DI-токеном.
//
// Ссылки на источники (accrualId/lineId/ruleId) — идентификаторы, а не
// копии: детализация начисления живёт в документе, лента ведёт на него по
// accrualId и не может с ним разойтись.
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

    // Ручное движение руководителя (Фаза 7 PRD 2): знак подставляется по
    // типу (расход — минус, приход — плюс), для ADJUSTMENT берётся как
    // передан (задаётся явно). Дата задним числом разрешена — в т.ч. внутри
    // закрытого месяца, снапшот и документы начисления при этом не
    // трогаются (движение их вообще не читает). Лимитов на аванс нет:
    // отрицательный остаток — штатная ситуация, никакая проверка текущего
    // баланса здесь сознательно не выполняется. erpSyncRequired в этой
    // итерации только хранится (синхронизация с кассой ERP — PRD 3).
    static createManual(
        create: CreateManualBalanceTransactionProps,
    ): BalanceTransaction {
        const magnitude = create.amount;
        let amount: number;
        if (create.type === 'ADJUSTMENT') {
            amount = magnitude;
        } else {
            if (magnitude <= 0) {
                throw new ArgumentInvalidException(
                    `Сумма движения типа ${create.type} — положительное число: знак подставляется по типу`,
                );
            }
            amount = MANUAL_OUTFLOW_TYPES.has(create.type)
                ? -magnitude
                : magnitude;
        }
        return new BalanceTransaction({
            id: randomUUID(),
            props: {
                employeeId: create.employeeId,
                direction: create.direction,
                type: create.type,
                amount,
                occurredAt: create.occurredAt ?? new Date(),
                createdBy: create.createdBy,
                comment: create.comment,
                period: create.period,
                erpSyncRequired: create.erpSyncRequired ?? false,
            },
        });
    }

    // Выплата (PRD 3, Фаза 12): движение PAYOUT, всегда расход (amount
    // хранится отрицательным — та же конвенция, что у ручных outflow-типов),
    // erpSyncRequired всегда true — выплата обязана иметь связанный
    // ErpCashDocument («Создаётся для каждой выплаты», PRD 3). Обработчик
    // выплаты (следующие агенты Фазы 12) вызывает эту фабрику ПОСЛЕ
    // успешного ErpCashDocumentPort.create() — сама сущность не обращается
    // в ERP и не проверяет остаток (PRD 3: «Ограничений по остатку нет...
    // остаток может быть нулевым или отрицательным» — предупреждение и
    // confirmNegativeBalance — забота application-слоя, у него есть доступ
    // к текущему остатку через BalanceTransactionRepositoryPort, сущность
    // его не знает).
    static forPayout(create: CreatePayoutProps): BalanceTransaction {
        if (create.amount <= 0) {
            throw new ArgumentInvalidException(
                'Сумма выплаты — положительное число: остаток уменьшается автоматически',
            );
        }
        return new BalanceTransaction({
            id: randomUUID(),
            props: {
                employeeId: create.employeeId,
                direction: create.direction,
                type: 'PAYOUT',
                amount: -create.amount,
                occurredAt: create.occurredAt ?? new Date(),
                createdBy: create.createdBy,
                comment: create.comment,
                erpSyncRequired: true,
            },
        });
    }

    // Ручное движение руководителя — единственный вид движения, доступный
    // прямому удалению (Фаза 8b, см. ensureDeletable).
    isManual(): boolean {
        return MANUAL_TYPES.has(this.props.type);
    }

    // Прямое удаление движения (DELETE .../balance/transactions/:id)
    // разрешено только ручным движениям (Фаза 8b): движения начисления
    // удаляются действием «Отменить начисление» строки документа, выплата
    // (PAYOUT, не входит в MANUAL_TYPES) — только своим собственным
    // эндпоинтом DELETE .../payout/:id (PRD 3), не этим общим. Документ ERP
    // сам по себе больше не блокирует удаление здесь (Фаза 11 отклоняла
    // erpSyncRequired: true с 409 как временную заглушку, пока не было
    // адаптера) — с Фазы 12 DeleteBalanceTransactionHandler умеет удалить
    // связанный ErpCashDocument перед удалением движения (PRD 3, «Уточнение
    // к PRD 2»: «Ручное движение с erpSyncRequired = true удаляется вместе
    // с документом ERP»), поэтому наличие erpSyncRequired само по себе
    // больше не 409.
    ensureDeletable(): void {
        if (!this.isManual()) {
            throw new BalanceTransactionNotDeletableException(
                this.id,
                'удаляются только ручные движения (начисление отменяется на строке документа, выплата удаляется своим DELETE .../payout/:id)',
            );
        }
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
        // Инварианты ручных движений (Фаза 7): знак зафиксирован типом
        // (расход хранится отрицательным, приход положительным),
        // ADJUSTMENT не бывает нулевым, а у PENALTY/ADJUSTMENT —
        // обязательный комментарий с причиной.
        if (
            MANUAL_OUTFLOW_TYPES.has(
                this.props.type as ManualBalanceTransactionType,
            ) &&
            this.props.amount >= 0
        ) {
            throw new ArgumentInvalidException(
                `Движение типа ${this.props.type} — расход: сумма хранится отрицательной`,
            );
        }
        if (
            MANUAL_INFLOW_TYPES.has(
                this.props.type as ManualBalanceTransactionType,
            ) &&
            this.props.amount <= 0
        ) {
            throw new ArgumentInvalidException(
                `Движение типа ${this.props.type} — приход: сумма хранится положительной`,
            );
        }
        if (this.props.type === 'ADJUSTMENT' && this.props.amount === 0) {
            throw new ArgumentInvalidException(
                `Движение типа ${this.props.type} не может быть нулевым`,
            );
        }
        // Выплата (PRD 3, Фаза 12) — тот же приём, что MANUAL_OUTFLOW_TYPES
        // выше: PAYOUT в этот набор не входит (isManual() должен оставаться
        // false для выплаты, см. ensureDeletable), поэтому знак проверяется
        // отдельной веткой, а не добавлением PAYOUT в MANUAL_OUTFLOW_TYPES.
        if (this.props.type === 'PAYOUT' && this.props.amount >= 0) {
            throw new ArgumentInvalidException(
                'Движение типа PAYOUT — расход: сумма хранится отрицательной',
            );
        }
        if (
            COMMENT_REQUIRED_TYPES.has(this.props.type) &&
            (!this.props.comment || this.props.comment.trim().length === 0)
        ) {
            throw new ArgumentNotProvidedException(
                `Движение типа ${this.props.type} требует комментария с причиной`,
            );
        }
    }
}

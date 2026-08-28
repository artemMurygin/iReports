import type { ManualBalanceTransactionType } from 'ireports-contracts';
import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Ручное движение по балансу сотрудника (PRD 2, Фаза 7): аванс, доп.
// аванс, премия, больничный, отпускные, штраф, корректировка. Баланс общий
// по сотруднику (Фаза 8b): эндпоинт один, без направления в пути, а
// direction — атрибут происхождения движения из тела запроса (форма
// выбирает, к какой кассе ERP движение относится — PRD 3). amount —
// абсолютная величина для типов со знаком по типу, со знаком — для
// ADJUSTMENT (знак задаётся явно); подстановка знака — в
// BalanceTransaction.createManual. createdBy — Bitrix ID руководителя
// (текущего пользователя в бэкенде нет).
export class CreateBalanceTransactionCommand extends Command {
    readonly direction: AccountingDirection;
    readonly employeeId: number;
    readonly type: ManualBalanceTransactionType;
    readonly amount: number;
    readonly occurredAt?: Date;
    readonly comment?: string;
    readonly period?: string;
    readonly createdBy: number;
    readonly erpSyncRequired: boolean;

    constructor(props: CommandProps<CreateBalanceTransactionCommand>) {
        super(props);
        this.direction = props.direction;
        this.employeeId = props.employeeId;
        this.type = props.type;
        this.amount = props.amount;
        this.occurredAt = props.occurredAt;
        this.comment = props.comment;
        this.period = props.period;
        this.createdBy = props.createdBy;
        this.erpSyncRequired = props.erpSyncRequired;
    }
}

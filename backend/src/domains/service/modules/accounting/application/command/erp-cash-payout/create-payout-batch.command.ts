import { Command, CommandProps } from '@/shared/domain/command.base';

// Массовая выплата направления service (PRD 3, «День выплаты»): «Руководитель
// выбирает несколько сотрудников... → по каждому создаётся выплата на его
// остаток» — amount НЕ передаётся, сервер берёт остаток каждого сотрудника
// на момент операции (см. CreatePayoutBatchHandler). direction — литерал в
// хендлере, как у CreatePayoutCommand.
export class CreatePayoutBatchCommand extends Command {
    readonly employeeIds: number[];
    readonly createdBy: number;
    readonly comment?: string;
    readonly occurredAt?: Date;
    readonly confirmNegativeBalance?: boolean;

    constructor(props: CommandProps<CreatePayoutBatchCommand>) {
        super(props);
        this.employeeIds = props.employeeIds;
        this.createdBy = props.createdBy;
        this.comment = props.comment;
        this.occurredAt = props.occurredAt;
        this.confirmNegativeBalance = props.confirmNegativeBalance;
    }
}

import { Command, CommandProps } from '@/shared/domain/command.base';

// Массовая выплата направления shop (PRD 3, «День выплаты»): «Руководитель
// выбирает несколько сотрудников... → по каждому создаётся выплата на его
// остаток» — amount НЕ передаётся, сервер берёт остаток каждого сотрудника
// на момент операции (см. CreateShopPayoutBatchHandler). Зеркалит
// CreatePayoutBatchCommand направления service — собственный класс по той
// же причине, что и CreateShopPayoutCommand (см. WHY там).
export class CreateShopPayoutBatchCommand extends Command {
    readonly employeeIds: number[];
    readonly createdBy: number;
    readonly comment?: string;
    readonly occurredAt?: Date;
    readonly confirmNegativeBalance?: boolean;

    constructor(props: CommandProps<CreateShopPayoutBatchCommand>) {
        super(props);
        this.employeeIds = props.employeeIds;
        this.createdBy = props.createdBy;
        this.comment = props.comment;
        this.occurredAt = props.occurredAt;
        this.confirmNegativeBalance = props.confirmNegativeBalance;
    }
}

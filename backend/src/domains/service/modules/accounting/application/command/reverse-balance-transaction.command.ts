import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Сторно ручного движения (PRD 2, Фаза 7): MANUAL_REVERSAL на точную
// противоположность исходной суммы с обязательным комментарием. Generic по
// direction; PATCH/DELETE движения не существует — сторно и есть
// единственный способ исправить ручное движение без документа ERP.
export class ReverseBalanceTransactionCommand extends Command {
    readonly direction: AccountingDirection;
    readonly transactionId: string;
    readonly comment: string;
    readonly createdBy: number;

    constructor(props: CommandProps<ReverseBalanceTransactionCommand>) {
        super(props);
        this.direction = props.direction;
        this.transactionId = props.transactionId;
        this.comment = props.comment;
        this.createdBy = props.createdBy;
    }
}

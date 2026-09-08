import { Command, CommandProps } from '@/shared/domain/command.base';

// Удаление выплаты направления service (PRD 3, Фаза 12): DELETE
// /v1/service/accounting/payout/:id — не путать с общим DELETE
// .../balance/transactions/:id (Фаза 8b/12, только для ручных движений).
export class DeletePayoutCommand extends Command {
    readonly payoutId: string;

    constructor(props: CommandProps<DeletePayoutCommand>) {
        super(props);
        this.payoutId = props.payoutId;
    }
}

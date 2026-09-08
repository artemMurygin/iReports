import { Command, CommandProps } from '@/shared/domain/command.base';

// Удаление выплаты направления shop (PRD 3, Фаза 12): DELETE
// /v1/shop/accounting/payout/:id — не путать с общим DELETE
// .../balance/transactions/:id (Фаза 8b/12, только для ручных движений).
// Зеркалит DeletePayoutCommand направления service, собственный класс по
// той же причине, что и CreateShopPayoutCommand.
export class DeleteShopPayoutCommand extends Command {
    readonly payoutId: string;

    constructor(props: CommandProps<DeleteShopPayoutCommand>) {
        super(props);
        this.payoutId = props.payoutId;
    }
}

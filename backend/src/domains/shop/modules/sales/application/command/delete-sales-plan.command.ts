import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/sales/application/command/
// delete-sales-plan.command.ts (Фаза 7) — без поля direction.
export class DeleteShopSalesPlanCommand extends Command {
    readonly planId: string;

    constructor(props: CommandProps<DeleteShopSalesPlanCommand>) {
        super(props);
        this.planId = props.planId;
    }
}

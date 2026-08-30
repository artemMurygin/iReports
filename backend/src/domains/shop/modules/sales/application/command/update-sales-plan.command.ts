import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/sales/application/command/
// update-sales-plan.command.ts (Фаза 7) — без поля direction.
export class UpdateShopSalesPlanCommand extends Command {
    readonly planId: string;
    readonly turnover?: number;
    readonly margin?: number;
    readonly orderTypeIds?: number[];

    constructor(props: CommandProps<UpdateShopSalesPlanCommand>) {
        super(props);
        this.planId = props.planId;
        this.turnover = props.turnover;
        this.margin = props.margin;
        this.orderTypeIds = props.orderTypeIds;
    }
}

import { Command, CommandProps } from '@/shared/domain/command.base';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

export class UpdateSalesPlanCommand extends Command {
    readonly planId: string;
    readonly direction: SalesDirection;
    readonly turnover?: number;
    readonly margin?: number;
    readonly orderTypeIds?: number[];

    constructor(props: CommandProps<UpdateSalesPlanCommand>) {
        super(props);
        this.planId = props.planId;
        this.direction = props.direction;
        this.turnover = props.turnover;
        this.margin = props.margin;
        this.orderTypeIds = props.orderTypeIds;
    }
}

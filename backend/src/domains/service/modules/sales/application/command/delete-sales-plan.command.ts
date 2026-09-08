import { Command, CommandProps } from '@/shared/domain/command.base';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

export class DeleteSalesPlanCommand extends Command {
    readonly planId: string;
    readonly direction: SalesDirection;

    constructor(props: CommandProps<DeleteSalesPlanCommand>) {
        super(props);
        this.planId = props.planId;
        this.direction = props.direction;
    }
}

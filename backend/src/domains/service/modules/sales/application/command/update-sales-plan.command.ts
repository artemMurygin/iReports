import { Command, CommandProps } from '@/shared/domain/command.base';

export class UpdateSalesPlanCommand extends Command {
    readonly planId: string;
    readonly turnover?: number;
    readonly margin?: number;

    constructor(props: CommandProps<UpdateSalesPlanCommand>) {
        super(props);
        this.planId = props.planId;
        this.turnover = props.turnover;
        this.margin = props.margin;
    }
}

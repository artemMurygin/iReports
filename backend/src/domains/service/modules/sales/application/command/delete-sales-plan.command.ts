import { Command, CommandProps } from '@/shared/domain/command.base';

export class DeleteSalesPlanCommand extends Command {
    readonly planId: string;

    constructor(props: CommandProps<DeleteSalesPlanCommand>) {
        super(props);
        this.planId = props.planId;
    }
}

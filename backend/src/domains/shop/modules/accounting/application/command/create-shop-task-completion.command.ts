import { Command, CommandProps } from '@/shared/domain/command.base';

export class CreateShopTaskCompletionCommand extends Command {
    readonly employeeId: number;
    readonly period: string;
    readonly description: string;
    readonly createdBy: number;

    constructor(props: CommandProps<CreateShopTaskCompletionCommand>) {
        super(props);
        this.employeeId = props.employeeId;
        this.period = props.period;
        this.description = props.description;
        this.createdBy = props.createdBy;
    }
}

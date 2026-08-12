import { Command, CommandProps } from '@/shared/domain/command.base';

export class CloseAccountingPeriodCommand extends Command {
    readonly period: string;
    readonly closedBy: number;

    constructor(props: CommandProps<CloseAccountingPeriodCommand>) {
        super(props);
        this.period = props.period;
        this.closedBy = props.closedBy;
    }
}

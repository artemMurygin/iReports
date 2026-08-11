import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

export class CloseAccountingPeriodCommand extends Command {
    readonly direction: AccountingDirection;
    readonly period: string;
    readonly closedBy: number;

    constructor(props: CommandProps<CloseAccountingPeriodCommand>) {
        super(props);
        this.direction = props.direction;
        this.period = props.period;
        this.closedBy = props.closedBy;
    }
}

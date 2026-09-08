import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

export class RecalculateAccountingPeriodCommand extends Command {
    readonly direction: AccountingDirection;
    readonly period: string;

    constructor(props: CommandProps<RecalculateAccountingPeriodCommand>) {
        super(props);
        this.direction = props.direction;
        this.period = props.period;
    }
}

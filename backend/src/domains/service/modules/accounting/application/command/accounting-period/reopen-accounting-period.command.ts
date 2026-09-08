import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// confirm — валидировано на границе HTTP (reopenAccountingPeriodRequestSchema:
// confirm — z.literal(true)) раньше, чем команда доходит до хендлера, но
// поле оставлено здесь тоже — команда самодостаточна и не полагается на то,
// что её всегда собирает именно этот контроллер.
export class ReopenAccountingPeriodCommand extends Command {
    readonly direction: AccountingDirection;
    readonly period: string;

    constructor(props: CommandProps<ReopenAccountingPeriodCommand>) {
        super(props);
        this.direction = props.direction;
        this.period = props.period;
    }
}

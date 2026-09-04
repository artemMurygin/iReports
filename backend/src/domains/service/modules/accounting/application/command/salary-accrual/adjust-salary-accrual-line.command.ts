import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Корректировка строки документа начисления до проведения (PRD 2, Фаза 6):
// новая действующая сумма + обязательный комментарий + автор (Bitrix ID).
// Только для строки в DRAFT; originalAmount не меняется. Команда generic по
// direction, как AccrueSalaryAccrualLineCommand.
export class AdjustSalaryAccrualLineCommand extends Command {
    readonly direction: AccountingDirection;
    readonly accrualId: string;
    readonly lineId: string;
    readonly amount: number;
    readonly comment: string;
    readonly adjustedBy: number;

    constructor(props: CommandProps<AdjustSalaryAccrualLineCommand>) {
        super(props);
        this.direction = props.direction;
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
        this.amount = props.amount;
        this.comment = props.comment;
        this.adjustedBy = props.adjustedBy;
    }
}

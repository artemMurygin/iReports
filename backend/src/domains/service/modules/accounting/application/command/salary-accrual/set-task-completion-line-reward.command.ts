import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Первичный ручной ввод суммы+комментария строки TaskCompletion (раздел 13
// tasks.md add-task-based-salary-rule, design.md Decision 5) — только для
// строки, оркестратор расчёта пометил requiresManualInput. В отличие от
// AdjustSalaryAccrualLineCommand — нет adjustedBy (см. комментарий в
// contracts/commands/salary-accrual.ts, setTaskCompletionLineRewardRequestSchema):
// это первичный ввод, а не корректировка уже посчитанного значения. Команда
// generic по direction, как AdjustSalaryAccrualLineCommand.
export class SetTaskCompletionLineRewardCommand extends Command {
    readonly direction: AccountingDirection;
    readonly accrualId: string;
    readonly lineId: string;
    readonly amount: number;
    readonly comment: string;

    constructor(props: CommandProps<SetTaskCompletionLineRewardCommand>) {
        super(props);
        this.direction = props.direction;
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
        this.amount = props.amount;
        this.comment = props.comment;
    }
}

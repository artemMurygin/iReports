import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Отмена начисления строки (PRD 2, Фаза 6): движения SALARY_ACCRUAL и
// ACCRUAL_ADJUSTMENT строки удаляются с баланса (без следа — след в
// ленте черновику расчёта не нужен), строка возвращается в DRAFT. Команда
// generic по direction, как AccrueSalaryAccrualLineCommand.
export class UnaccrueSalaryAccrualLineCommand extends Command {
    readonly direction: AccountingDirection;
    readonly accrualId: string;
    readonly lineId: string;

    constructor(props: CommandProps<UnaccrueSalaryAccrualLineCommand>) {
        super(props);
        this.direction = props.direction;
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
    }
}

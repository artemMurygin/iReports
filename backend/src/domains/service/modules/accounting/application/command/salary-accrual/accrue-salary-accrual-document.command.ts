import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// «Начислить всё» по документу начисления (PRD 2, Фаза 7): массовое
// проведение всех непроведённых строк документа. Generic по direction —
// хендлер один, контроллеры обоих доменов диспатчат команду через общий
// CommandBus со своим направлением (тот же приём, что
// AccrueSalaryAccrualLineCommand).
export class AccrueSalaryAccrualDocumentCommand extends Command {
    readonly direction: AccountingDirection;
    readonly accrualId: string;
    readonly accruedBy: number;

    constructor(props: CommandProps<AccrueSalaryAccrualDocumentCommand>) {
        super(props);
        this.direction = props.direction;
        this.accrualId = props.accrualId;
        this.accruedBy = props.accruedBy;
    }
}

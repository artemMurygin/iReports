import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Проведение строки документа начисления на баланс (PRD 2, Фаза 6).
// Команда generic по direction — как ReopenAccountingPeriodCommand: хендлер
// один, зарегистрирован в AccountingModule сервиса, контроллеры обоих
// доменов диспатчат её через общий CommandBus со своим направлением.
// accruedBy — Bitrix ID руководителя, станет createdBy движений баланса.
export class AccrueSalaryAccrualLineCommand extends Command {
    readonly direction: AccountingDirection;
    readonly accrualId: string;
    readonly lineId: string;
    readonly accruedBy: number;

    constructor(props: CommandProps<AccrueSalaryAccrualLineCommand>) {
        super(props);
        this.direction = props.direction;
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
        this.accruedBy = props.accruedBy;
    }
}

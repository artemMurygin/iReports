import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// «Начислить все документы месяца» (PRD 2, Фаза 7): массовое проведение
// всех документов направления за период. Generic по direction, как
// AccrueSalaryAccrualDocumentCommand.
export class AccruePeriodSalaryAccrualsCommand extends Command {
    readonly direction: AccountingDirection;
    readonly period: string;
    readonly accruedBy: number;

    constructor(props: CommandProps<AccruePeriodSalaryAccrualsCommand>) {
        super(props);
        this.direction = props.direction;
        this.period = props.period;
        this.accruedBy = props.accruedBy;
    }
}

import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// adjust-salary-accrual-line.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop.
export class AdjustShopSalaryAccrualLineCommand extends Command {
    readonly accrualId: string;
    readonly lineId: string;
    readonly amount: number;
    readonly comment: string;
    readonly adjustedBy: number;

    constructor(props: CommandProps<AdjustShopSalaryAccrualLineCommand>) {
        super(props);
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
        this.amount = props.amount;
        this.comment = props.comment;
        this.adjustedBy = props.adjustedBy;
    }
}

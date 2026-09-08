import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// unaccrue-salary-accrual-line.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop.
export class UnaccrueShopSalaryAccrualLineCommand extends Command {
    readonly accrualId: string;
    readonly lineId: string;

    constructor(props: CommandProps<UnaccrueShopSalaryAccrualLineCommand>) {
        super(props);
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
    }
}

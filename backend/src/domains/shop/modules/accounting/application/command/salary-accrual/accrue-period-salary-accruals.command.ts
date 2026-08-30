import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// accrue-period-salary-accruals.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop.
export class AccruePeriodShopSalaryAccrualsCommand extends Command {
    readonly period: string;
    readonly accruedBy: number;

    constructor(props: CommandProps<AccruePeriodShopSalaryAccrualsCommand>) {
        super(props);
        this.period = props.period;
        this.accruedBy = props.accruedBy;
    }
}

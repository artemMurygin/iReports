import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// recalculate-accounting-period.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop.
export class RecalculateShopAccountingPeriodCommand extends Command {
    readonly period: string;

    constructor(props: CommandProps<RecalculateShopAccountingPeriodCommand>) {
        super(props);
        this.period = props.period;
    }
}

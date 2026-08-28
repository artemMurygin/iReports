import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// accrue-salary-accrual-line.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop, без поля direction: оно
// зафиксировано расположением класса (см. AccrueShopSalaryAccrualLineHandler).
export class AccrueShopSalaryAccrualLineCommand extends Command {
    readonly accrualId: string;
    readonly lineId: string;
    readonly accruedBy: number;

    constructor(props: CommandProps<AccrueShopSalaryAccrualLineCommand>) {
        super(props);
        this.accrualId = props.accrualId;
        this.lineId = props.lineId;
        this.accruedBy = props.accruedBy;
    }
}

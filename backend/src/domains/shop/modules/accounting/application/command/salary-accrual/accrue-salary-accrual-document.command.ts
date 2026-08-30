import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/accounting/application/command/
// accrue-salary-accrual-document.command.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop.
export class AccrueShopSalaryAccrualDocumentCommand extends Command {
    readonly accrualId: string;
    readonly accruedBy: number;

    constructor(props: CommandProps<AccrueShopSalaryAccrualDocumentCommand>) {
        super(props);
        this.accrualId = props.accrualId;
        this.accruedBy = props.accruedBy;
    }
}

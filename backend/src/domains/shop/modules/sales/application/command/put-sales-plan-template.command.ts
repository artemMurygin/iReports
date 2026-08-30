import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/sales/application/command/
// put-sales-plan-template.command.ts (Фаза 7) — без поля direction.
export class PutShopSalesPlanTemplateCommand extends Command {
    readonly department: number;
    readonly category?: string | null;
    readonly turnover: number;
    readonly margin: number;
    readonly orderTypeIds?: number[];
    readonly growthPercent: number;

    constructor(props: CommandProps<PutShopSalesPlanTemplateCommand>) {
        super(props);
        this.department = props.department;
        this.category = props.category;
        this.turnover = props.turnover;
        this.margin = props.margin;
        this.orderTypeIds = props.orderTypeIds;
        this.growthPercent = props.growthPercent;
    }
}

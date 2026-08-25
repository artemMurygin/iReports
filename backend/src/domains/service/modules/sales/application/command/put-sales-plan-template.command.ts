import { Command, CommandProps } from '@/shared/domain/command.base';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

export class PutSalesPlanTemplateCommand extends Command {
    readonly direction: SalesDirection;
    readonly department: number;
    readonly category?: string | null;
    readonly turnover: number;
    readonly margin: number;
    readonly orderTypeIds?: number[];
    readonly growthPercent: number;

    constructor(props: CommandProps<PutSalesPlanTemplateCommand>) {
        super(props);
        this.direction = props.direction;
        this.department = props.department;
        this.category = props.category;
        this.turnover = props.turnover;
        this.margin = props.margin;
        this.orderTypeIds = props.orderTypeIds;
        this.growthPercent = props.growthPercent;
    }
}

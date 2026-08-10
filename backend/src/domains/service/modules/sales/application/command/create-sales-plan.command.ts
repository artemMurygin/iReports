import { Command, CommandProps } from '@/shared/domain/command.base';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

export class CreateSalesPlanCommand extends Command {
    readonly direction: SalesDirection;
    readonly department: number;
    // undefined/null — план на отдел целиком, без разбивки по категории
    // (см. SalesPlanScope).
    readonly category?: number | null;
    readonly period: string;
    readonly turnover: number;
    readonly margin: number;

    constructor(props: CommandProps<CreateSalesPlanCommand>) {
        super(props);
        this.direction = props.direction;
        this.department = props.department;
        this.category = props.category;
        this.period = props.period;
        this.turnover = props.turnover;
        this.margin = props.margin;
    }
}

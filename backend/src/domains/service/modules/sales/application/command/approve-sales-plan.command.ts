import { Command, CommandProps } from '@/shared/domain/command.base';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

// Утверждение построчно (ids) или массово по направлению и месяцу
// (direction + period, все строки CREATED переходят в APPROVED). Ровно одна
// из двух пар должна быть задана — проверяется в handler'е, а не через две
// разные команды, чтобы у контроллера/DTO был один вход, зеркалящий
// approveSalesPlanRequestSchema (contracts/commands/sales-plan.ts).
export class ApproveSalesPlanCommand extends Command {
    readonly ids?: string[];
    readonly direction?: SalesDirection;
    readonly period?: string;
    readonly approvedBy: number;

    constructor(props: CommandProps<ApproveSalesPlanCommand>) {
        super(props);
        this.ids = props.ids;
        this.direction = props.direction;
        this.period = props.period;
        this.approvedBy = props.approvedBy;
    }
}

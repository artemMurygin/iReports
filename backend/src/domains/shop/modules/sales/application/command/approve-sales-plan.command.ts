import { Command, CommandProps } from '@/shared/domain/command.base';

// Зеркало domains/service/modules/sales/application/command/
// approve-sales-plan.command.ts (Фаза 7) — без поля direction: он
// зафиксирован самим хендлером. Утверждение построчно (ids) или массово по
// месяцу (period, все строки CREATED переходят в APPROVED). Ровно одна из
// пар (ids) / (period) должна быть задана — проверяется в handler'е.
export class ApproveShopSalesPlanCommand extends Command {
    readonly ids?: string[];
    readonly period?: string;
    readonly approvedBy: number;

    constructor(props: CommandProps<ApproveShopSalesPlanCommand>) {
        super(props);
        this.ids = props.ids;
        this.period = props.period;
        this.approvedBy = props.approvedBy;
    }
}

import { Command, CommandProps } from '@/shared/domain/command.base';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

// Утверждение построчно (ids) или массово по месяцу (period, все строки
// CREATED переходят в APPROVED). direction — одно на весь запрос
// (согласовано с approveSalesPlanRequestSchema в
// contracts/commands/sales-plan.ts, где направление задаётся путём
// эндпоинта, а не телом) и обязательно в обеих ветках: в ветке ids —
// граница доступа (планы чужого направления не утверждаются, даже если их
// id указан явно), в ветке period — как раньше, вход для поиска строк
// месяца. Ровно одна из пар (ids) / (period) должна быть задана —
// проверяется в handler'е, а не через две разные команды, чтобы у
// контроллера/DTO был один вход.
export class ApproveSalesPlanCommand extends Command {
    readonly ids?: string[];
    readonly direction: SalesDirection;
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

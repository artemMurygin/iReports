import { Command, CommandProps } from '@/shared/domain/command.base';
import type { UpdateSalesPlanOrderItem } from 'ireports-contracts';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

// Батч-обновление глобального (общего для всех пользователей) порядка
// строк-категорий плана продаж одного отдела — см.
// docs/sales-plan-row-drag-and-drop-reorder. direction — как и у остальных
// команд этого модуля, задаётся контроллером по домену, из которого пришёл
// запрос (/v1/service/... или /v1/shop/...), а не телом клиента. items —
// список категорий (сентинел null = "без категории") с их новым порядком;
// хендлер трогает только SalesPlanTemplate.sortOrder соответствующих строк
// шаблона, не создавая и не меняя строки самого SalesPlan.
export class UpdateSalesPlanOrderCommand extends Command {
    readonly direction: SalesDirection;
    readonly department: number;
    readonly items: UpdateSalesPlanOrderItem[];

    constructor(props: CommandProps<UpdateSalesPlanOrderCommand>) {
        super(props);
        this.direction = props.direction;
        this.department = props.department;
        this.items = props.items;
    }
}

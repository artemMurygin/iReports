import { Command, CommandProps } from '@/shared/domain/command.base';
import type { UpdateSalesPlanOrderItem } from 'ireports-contracts';

// Зеркало domains/service/modules/sales/application/command/
// update-sales-plan-order.command.ts (Фаза 1, docs/
// sales-plan-row-drag-and-drop-reorder) — независимая команда направления
// shop, без поля direction (зафиксирован реализацией репозиториев, как и у
// остальных команд этого модуля — см. PutShopSalesPlanTemplateCommand).
//
// Батч-обновление глобального (общего для всех пользователей) порядка
// строк-категорий плана продаж одного отдела. items — список категорий
// (сентинел null = "без категории") с их новым порядком; хендлер трогает
// только ShopSalesPlanTemplate.sortOrder соответствующих строк шаблона, не
// создавая и не меняя строки самого ShopSalesPlan.
//
// Закрытый расчётный период (AccountingPeriod) НЕ блокирует эту команду —
// осознанное решение Фазы 4, см. подробное обоснование в комментарии у
// UpdateShopSalesPlanOrderHandler.execute().
export class UpdateShopSalesPlanOrderCommand extends Command {
    readonly department: number;
    readonly items: UpdateSalesPlanOrderItem[];

    constructor(props: CommandProps<UpdateShopSalesPlanOrderCommand>) {
        super(props);
        this.department = props.department;
        this.items = props.items;
    }
}

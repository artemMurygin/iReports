import { Command, CommandProps } from '@/shared/domain/command.base';
import type { CreateSalesPlanItemRequest } from 'ireports-contracts';

// Зеркало domains/service/modules/sales/application/command/
// create-sales-plan.command.ts (Фаза 7 docs/service-shop-boundary-violations-fix)
// — независимая команда для направления shop, без поля direction: он
// зафиксирован самим хендлером (CreateShopSalesPlanHandler), а не читается
// из command props. plans — всегда массив, даже для одиночного создания
// (контроллер нормализует один объект в массив из одного элемента).
export class CreateShopSalesPlanCommand extends Command {
    readonly plans: CreateSalesPlanItemRequest[];

    constructor(props: CommandProps<CreateShopSalesPlanCommand>) {
        super(props);
        this.plans = props.plans;
    }
}

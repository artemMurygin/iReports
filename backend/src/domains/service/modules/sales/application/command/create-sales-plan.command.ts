import { Command, CommandProps } from '@/shared/domain/command.base';
import type { CreateSalesPlanItemRequest } from 'ireports-contracts';
import type { SalesDirection } from '../../domain/types/sales-plan.types';

// direction — одно на весь батч (согласовано с createSalesPlanRequestSchema
// в contracts/commands/sales-plan.ts, где направление общее на весь HTTP-
// запрос, а не на строку); plans — всегда массив, даже для одиночного
// создания (контроллер нормализует один объект в массив из одного
// элемента): хендлеру не нужно знать, была ли это batch-форма запроса или
// нет, он просто создаёт все строки атомарно.
export class CreateSalesPlanCommand extends Command {
    readonly direction: SalesDirection;
    readonly plans: CreateSalesPlanItemRequest[];

    constructor(props: CommandProps<CreateSalesPlanCommand>) {
        super(props);
        this.direction = props.direction;
        this.plans = props.plans;
    }
}

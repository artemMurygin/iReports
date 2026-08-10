import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
    ApproveSalesPlanRequest,
    SalesPlanResponse,
} from 'ireports-contracts';
import { approveSalesPlanRequestSchema } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ApproveSalesPlanCommand } from '../../application/command/approve-sales-plan.command';

@Controller(routesV1.version)
export class ApproveSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело — дискриминированный по форме union (ids | direction+period, см.
    // approveSalesPlanRequestSchema), а не единый объект: createZodDto не
    // умеет расширять класс union-схемой (TS2509, инстанс DTO — не объектный
    // тип), поэтому валидация идёт схемой напрямую через ZodValidationPipe,
    // без промежуточного DTO-класса.
    @Post(routesV1.salesPlan.approve)
    async approve(
        @Body(new ZodValidationPipe(approveSalesPlanRequestSchema))
        body: ApproveSalesPlanRequest,
    ): Promise<SalesPlanResponse[]> {
        const command = new ApproveSalesPlanCommand(body);
        return this.commandBus.execute(command);
    }
}

import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { SalesPlanResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { SalesPlanCreateDto } from '../dto/sales-plan-create.dto';
import { CreateSalesPlanCommand } from '../../application/command/create-sales-plan.command';

@Controller(routesV1.version)
export class CreateSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.salesPlan.root)
    @HttpCode(HttpStatus.CREATED)
    async create(@Body() body: SalesPlanCreateDto): Promise<SalesPlanResponse> {
        const command = new CreateSalesPlanCommand(body);
        return this.commandBus.execute(command);
    }
}

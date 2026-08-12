import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
    ApproveSalesPlanRequest,
    SalesPlanResponse,
} from 'ireports-contracts';
import { approveSalesPlanRequestSchema } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { zodSchemaToOpenApiBody } from '@/shared/utils/zod-schema-to-open-api-body';
import { ApproveSalesPlanCommand } from '@/domains/service/modules/sales/application/command/approve-sales-plan.command';

// direction: 'shop' подставляется здесь, а не читается из тела —
// approveSalesPlanRequestSchema общий с направлением service. В ветке ids
// хендлер (ApproveSalesPlanHandler.resolveTargets) отклоняет весь запрос
// целиком, если среди id встретится план другого направления (см.
// комментарий там) — не утверждает частично.
@ApiTags('Продажи')
@Controller()
export class ApproveShopSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.shop.salesPlan.approve)
    @ApiOperation({
        summary:
            'Утвердить план продаж направления shop построчно или весь месяц',
    })
    @ApiBody({
        description:
            'Union: { ids, approvedBy } — утвердить конкретные строки по id, либо { period, approvedBy } — утвердить весь месяц направления shop',
        schema: zodSchemaToOpenApiBody(approveSalesPlanRequestSchema),
    })
    async approve(
        @Body(new ZodValidationPipe(approveSalesPlanRequestSchema))
        body: ApproveSalesPlanRequest,
    ): Promise<SalesPlanResponse[]> {
        const command = new ApproveSalesPlanCommand({
            ...body,
            direction: 'shop',
        });
        return this.commandBus.execute(command);
    }
}

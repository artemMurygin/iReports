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
import { ApproveShopSalesPlanCommand } from '../../application/command/approve-sales-plan.command';

// Диспатчит ApproveShopSalesPlanCommand — собственная команда/хендлер
// направления shop (Фаза 7 docs/service-shop-boundary-violations-fix). В
// ветке ids строка чужого направления никогда не резолвится (репозиторий
// фильтрует по direction: 'shop' на уровне Prisma-запроса, см.
// ApproveShopSalesPlanHandler) — весь запрос отклоняется, если среди id
// встретится план другого направления.
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
        const command = new ApproveShopSalesPlanCommand({
            ...body,
        });
        return this.commandBus.execute(command);
    }
}

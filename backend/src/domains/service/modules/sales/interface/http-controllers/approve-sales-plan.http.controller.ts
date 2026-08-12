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
import { ApproveSalesPlanCommand } from '../../application/command/approve-sales-plan.command';

@ApiTags('Продажи')
@Controller()
export class ApproveSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело — дискриминированный по форме union (ids | period, см.
    // approveSalesPlanRequestSchema), а не единый объект: createZodDto не
    // умеет расширять класс union-схемой (TS2509, инстанс DTO — не объектный
    // тип), поэтому валидация идёт схемой напрямую через ZodValidationPipe,
    // без промежуточного DTO-класса. Эндпоинт обслуживает только
    // direction: 'service' (путь под /v1/service) — направление
    // подставляется здесь, а не читается из тела клиента; в ветке ids
    // строки чужого направления отклоняют весь запрос (см.
    // ApproveSalesPlanHandler).
    @Post(routesV1.service.salesPlan.approve)
    @ApiOperation({
        summary:
            'Утвердить план продаж построчно или весь месяц по направлению',
    })
    @ApiBody({
        description:
            'Union: { ids, approvedBy } — утвердить конкретные строки по id, либо { period, approvedBy } — утвердить весь месяц по направлению service',
        schema: zodSchemaToOpenApiBody(approveSalesPlanRequestSchema),
    })
    async approve(
        @Body(new ZodValidationPipe(approveSalesPlanRequestSchema))
        body: ApproveSalesPlanRequest,
    ): Promise<SalesPlanResponse[]> {
        const command = new ApproveSalesPlanCommand({
            ...body,
            direction: 'service',
        });
        return this.commandBus.execute(command);
    }
}

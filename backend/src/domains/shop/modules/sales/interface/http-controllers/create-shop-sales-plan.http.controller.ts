import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
    CreateSalesPlanRequest,
    SalesPlanResponse,
} from 'ireports-contracts';
import { createSalesPlanRequestSchema } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { zodSchemaToOpenApiBody } from '@/shared/utils/zod-schema-to-open-api-body';
import { CreateShopSalesPlanCommand } from '../../application/command/create-shop-sales-plan.command';

// Диспатчит CreateShopSalesPlanCommand — собственная команда/хендлер
// направления shop (Фаза 7 docs/service-shop-boundary-violations-fix), не
// переиспользует CreateSalesPlanCommand направления service: SalesPlan —
// общая Prisma-модель (см. domains/service/CLAUDE.md), но CQRS-вход
// каждого домена свой.
@ApiTags('Продажи')
@Controller()
export class CreateShopSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело — один план или массив планов (union, см.
    // createSalesPlanRequestSchema из contracts — direction в схеме не
    // содержится вообще, тот же контракт, что и у сервисного эквивалента) —
    // createZodDto не умеет расширять класс union-схемой (TS2509).
    @Post(routesV1.shop.salesPlan.root)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:
            'Создать план месяца по отделу и, опционально, категории для направления shop — один или несколько за запрос',
    })
    @ApiBody({
        description:
            'Union: один объект плана, либо { items: [...] } — непустой батч планов. Вся комбинация (department, category, period) должна быть уникальна для направления shop как в БД, так и внутри самого запроса; если хотя бы одна строка конфликтует, не создаётся ни одна (атомарно)',
        schema: zodSchemaToOpenApiBody(createSalesPlanRequestSchema),
    })
    async create(
        @Body(new ZodValidationPipe(createSalesPlanRequestSchema))
        body: CreateSalesPlanRequest,
    ): Promise<SalesPlanResponse | SalesPlanResponse[]> {
        const isBatch = 'items' in body;
        const items = isBatch ? body.items : [body];
        const command = new CreateShopSalesPlanCommand({
            plans: items,
        });
        const created = await this.commandBus.execute<
            CreateShopSalesPlanCommand,
            SalesPlanResponse[]
        >(command);
        return isBatch ? created : created[0];
    }
}

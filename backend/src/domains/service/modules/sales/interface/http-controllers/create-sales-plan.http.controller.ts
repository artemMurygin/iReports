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
import { CreateSalesPlanCommand } from '../../application/command/create-sales-plan.command';

@ApiTags('Продажи')
@Controller()
export class CreateSalesPlanHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    // Тело — union (см. createSalesPlanRequestSchema): один план либо батч
    // ({ items: [...] }) — а не единый объектный DTO: createZodDto не умеет
    // расширять класс union-схемой (TS2509, инстанс DTO — не объектный тип),
    // поэтому валидация идёт схемой напрямую через ZodValidationPipe — как в
    // ApproveSalesPlanHttpController. Форма ответа зеркалит форму тела:
    // один объект на входе — один объект на выходе, батч — массив, чтобы
    // не ломать уже существующих потребителей одиночного объекта.
    // Эндпоинт обслуживает только direction: 'service' (путь под
    // /v1/service) — direction не принимается в теле вообще, схема его не
    // содержит.
    @Post(routesV1.service.salesPlan.root)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:
            'Создать план месяца по отделу и, опционально, категории — один или несколько за запрос',
    })
    @ApiBody({
        description:
            'Union: один объект плана, либо { items: [...] } — батч на несколько отделов/категорий одним запросом. Комбинация (department, category, period) должна быть уникальна в рамках направления service как в БД, так и внутри самого батча; если хотя бы одна строка конфликтует, не создаётся ни одна (атомарно)',
        schema: zodSchemaToOpenApiBody(createSalesPlanRequestSchema),
    })
    async create(
        @Body(new ZodValidationPipe(createSalesPlanRequestSchema))
        body: CreateSalesPlanRequest,
    ): Promise<SalesPlanResponse | SalesPlanResponse[]> {
        if ('items' in body) {
            const command = new CreateSalesPlanCommand({
                direction: 'service',
                plans: body.items,
            });
            return this.commandBus.execute<
                CreateSalesPlanCommand,
                SalesPlanResponse[]
            >(command);
        }

        const command = new CreateSalesPlanCommand({
            direction: 'service',
            plans: [body],
        });
        const created = await this.commandBus.execute<
            CreateSalesPlanCommand,
            SalesPlanResponse[]
        >(command);
        return created[0];
    }
}

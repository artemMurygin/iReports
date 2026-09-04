import { Body, Controller, Post } from '@nestjs/common';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MotivationSchemaCreateDto } from '../dto/motivation-schema-create.dto';
import { MotivationResponse } from 'ireports-contracts';
import { CreateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/create-motivation-schema.command';

@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class CreateMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.service.motivationSchema.root)
    @ApiOperation({
        summary: 'Создать мотивационную схему сотрудника или отдела',
    })
    async create(
        @Body() body: MotivationSchemaCreateDto,
    ): Promise<MotivationResponse> {
        const command = new CreateMotivationSchemaCommand(body);
        return await this.commandBus.execute(command);
    }
}

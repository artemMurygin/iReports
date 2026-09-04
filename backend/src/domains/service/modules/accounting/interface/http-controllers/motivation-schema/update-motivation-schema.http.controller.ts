import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { MotivationResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { UpdateMotivationSchemaDto } from '../../dto/motivation-schema/update-motivation-schema.dto';
import { UpdateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/update-motivation-schema.command';

@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class UpdateMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.service.motivationSchema.byId)
    @ApiOperation({
        summary:
            'Переименовать мотивационную схему и заменить набор её правил направления сервис',
    })
    async update(
        @Param('id') id: string,
        @Body() body: UpdateMotivationSchemaDto,
    ): Promise<MotivationResponse> {
        const command = new UpdateMotivationSchemaCommand({
            motivationSchemaId: id,
            name: body.name,
            rules: body.rules,
        });
        return await this.commandBus.execute(command);
    }
}

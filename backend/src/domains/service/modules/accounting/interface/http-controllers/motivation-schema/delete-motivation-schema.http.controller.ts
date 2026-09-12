import {
    Controller,
    Delete,
    HttpCode,
    HttpStatus,
    Param,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { DeleteMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/delete-motivation-schema.command';

// Implements FR1 of delete-motivation-schema.
@ApiTags('Бухгалтерия: мотивационная схема')
@Controller()
export class DeleteMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Delete(routesV1.service.motivationSchema.byId)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Удалить мотивационную схему целиком' })
    async delete(@Param('id') id: string): Promise<void> {
        const command = new DeleteMotivationSchemaCommand({ schemaId: id });
        await this.commandBus.execute(command);
    }
}

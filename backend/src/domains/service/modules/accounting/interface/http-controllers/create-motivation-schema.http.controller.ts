import { Body, Controller, Post } from '@nestjs/common';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { MotivationSchemaCreateDto } from '../dto/motivation-schema-create.dto';
import { MotivationResponse } from 'ireports-contracts';
import { CreateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/create-motivation-schema.command';

@Controller(routesV1.version)
export class CreateMotivationSchemaHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.motivationSchema.root)
    async create(
        @Body() body: MotivationSchemaCreateDto,
    ): Promise<MotivationResponse> {
        const command = new CreateMotivationSchemaCommand(body);
        return await this.commandBus.execute(command);
    }
}

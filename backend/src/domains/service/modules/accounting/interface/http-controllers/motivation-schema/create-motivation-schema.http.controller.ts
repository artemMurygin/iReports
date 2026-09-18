import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '@/modules/roles/interface/permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { routesV1 } from '@/config/app.routes';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MotivationSchemaCreateDto } from '../../dto/motivation-schema/motivation-schema-create.dto';
import { MotivationResponse } from 'ireports-contracts';
import { CreateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-motivation-schema.command';

@ApiTags('Бухгалтерия: мотивационная схема')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('service-accounting:manage_schema')
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

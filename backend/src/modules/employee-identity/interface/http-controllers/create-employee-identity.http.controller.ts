import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';
import { EmployeeIdentityCreateDto } from '../dto/employee-identity-create.dto';
import { CreateEmployeeIdentityCommand } from '../../application/command/create-employee-identity.command';

@UseGuards(PortalAdminGuard)
@Controller(routesV1.version)
export class CreateEmployeeIdentityHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.employeeIdentity.root)
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() body: EmployeeIdentityCreateDto,
    ): Promise<EmployeeIdentityResponse> {
        const command = new CreateEmployeeIdentityCommand(body);
        return this.commandBus.execute(command);
    }
}

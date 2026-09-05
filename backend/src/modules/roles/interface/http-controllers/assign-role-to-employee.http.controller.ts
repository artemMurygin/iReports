import {
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';
import { SessionAuthGuard } from '@/modules/session/interface/session-auth.guard';
import { CsrfGuard } from '@/modules/session/interface/csrf.guard';
import { PermissionsGuard } from '../permissions.guard';
import { RequirePermissions } from '@/shared/decorators/require-permissions.decorator';
import { RolesCommandHandlers } from '../../application/command/roles-command-handlers.service';

// spec: roles#model-role-permission — многие-ко-многим EmployeeRole. Список
// сотрудников для UI — через уже существующий GET /directory/employees
// (design.md, Decision 1), не через этот модуль.
@ApiTags('Роли и доступ: управление ролями')
@UseGuards(SessionAuthGuard, CsrfGuard, PermissionsGuard)
@RequirePermissions('roles:manage')
@Controller()
export class AssignRoleToEmployeeHttpController {
    constructor(private readonly commandHandlers: RolesCommandHandlers) {}

    @Post(routesV1.roles.employeeAssignment)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Назначить роль сотруднику' })
    async assign(
        @Param('id') roleId: string,
        @Param('employeeId', ParseIntPipe) employeeId: number,
    ): Promise<void> {
        await this.commandHandlers.assignRoleToEmployee(employeeId, roleId);
    }
}

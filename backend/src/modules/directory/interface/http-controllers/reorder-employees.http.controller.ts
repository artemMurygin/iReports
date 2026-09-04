import { Body, Controller, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ReorderEmployeesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ReorderEmployeesDto } from '../dto/reorder-employees.dto';
import { ReorderEmployeesCommand } from '../../application/command/reorder-employees.command';

// Без гарда — тот же принцип, что и у остальных эндпоинтов справочника (см.
// WHY над routesV1.directory в app.routes.ts): менять порядок сотрудников
// может любой авторизованный пользователь платформы, без отдельных прав/
// ролей (PRD docs/employee-ordering-and-salary-filter, "В скоупе" п.5).
@ApiTags('Справочник: отделы и сотрудники')
@Controller()
export class ReorderEmployeesHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.directory.reorderEmployees)
    @ApiOperation({
        summary:
            'Сохранить новый порядок сотрудников (глобальный, общий для всех списков сотрудников)',
    })
    async reorder(
        @Body() body: ReorderEmployeesDto,
    ): Promise<ReorderEmployeesResponse> {
        const command = new ReorderEmployeesCommand({ items: body.items });
        return this.commandBus.execute(command);
    }
}

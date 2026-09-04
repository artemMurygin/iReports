import { Body, Controller, Param, Patch } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { SetEmployeeServiceAccountResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { SetEmployeeServiceAccountDto } from '../dto/set-employee-service-account.dto';
import { SetEmployeeServiceAccountCommand } from '../../application/command/set-employee-service-account.command';

// Без гарда — тот же принцип, что и у ReorderEmployeesHttpController (см. WHY
// над routesV1.directory в app.routes.ts): менять признак «служебный
// аккаунт» может любой авторизованный пользователь платформы, без отдельных
// прав/ролей (модель прав в проекте не введена).
@ApiTags('Справочник: отделы и сотрудники')
@Controller()
export class SetEmployeeServiceAccountHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Patch(routesV1.directory.setServiceAccount)
    @ApiOperation({
        summary:
            'Включить/выключить признак «служебный аккаунт» у сотрудника — исключает его из зарплатных списков/расчётов',
    })
    async setServiceAccount(
        @Param('id') id: string,
        @Body() body: SetEmployeeServiceAccountDto,
    ): Promise<SetEmployeeServiceAccountResponse> {
        const employeeId = Number(id);
        if (!Number.isInteger(employeeId)) {
            throw new ArgumentInvalidException(
                `id сотрудника должен быть числом, получено: "${id}"`,
            );
        }

        const command = new SetEmployeeServiceAccountCommand({
            employeeId,
            isServiceAccount: body.isServiceAccount,
        });
        return this.commandBus.execute(command);
    }
}

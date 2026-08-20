import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { EmployeeIdentityCreateDto } from '../dto/employee-identity-create.dto';
import { CreateEmployeeIdentityCommand } from '../../application/command/create-employee-identity.command';

// Ограничение «только администратор портала Bitrix24» (PRD, раздел 1) снято по
// решению пользователя: страница управления связями работает вне встроенного в
// Bitrix24 контекста и не может прислать заголовок x-bitrix-auth, без которого
// гард fail-closed отдаёт 403 на любой запрос.
//
// Гард снят именно комментированием, а не удалением: PortalAdminGuard и
// BitrixPortalAdminCheckService остаются в src/integrations/bitrix/auth вместе
// со своим юнит-тестом. Чтобы вернуть ограничение — раскомментировать импорт и
// декоратор здесь и в четырёх соседних контроллерах модуля, вернуть UseGuards в
// импорт из '@nestjs/common' и раскомментировать три теста на 403 в
// employee-identity.e2e.spec.ts.
// import { PortalAdminGuard } from '@/integrations/bitrix/auth/portal-admin.guard';

// @UseGuards(PortalAdminGuard)
@ApiTags('Идентификация сотрудников')
@Controller(routesV1.version)
export class CreateEmployeeIdentityHttpController {
    constructor(private readonly commandBus: CommandBus) {}

    @Post(routesV1.employeeIdentity.root)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary:
            'Создать связь сотрудника Bitrix с внешней системой (RemOnline/МойСклад)',
    })
    async create(
        @Body() body: EmployeeIdentityCreateDto,
    ): Promise<EmployeeIdentityResponse> {
        const command = new CreateEmployeeIdentityCommand(body);
        return this.commandBus.execute(command);
    }
}

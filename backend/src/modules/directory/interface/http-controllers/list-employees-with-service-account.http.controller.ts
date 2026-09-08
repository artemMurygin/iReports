import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListEmployeesWithServiceAccountResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListEmployeesWithServiceAccountService } from '../../application/services/list-employees-with-service-account.service';

@ApiTags('Справочник: отделы и сотрудники')
@Controller()
export class ListEmployeesWithServiceAccountHttpController {
    constructor(
        private readonly listEmployeesWithServiceAccount: ListEmployeesWithServiceAccountService,
    ) {}

    @Get(routesV1.directory.employeesWithServiceAccount)
    @ApiOperation({
        summary:
            'Полный список сотрудников (включая служебные аккаунты) с их текущим признаком «служебный» — для страницы настроек и связей сотрудников',
    })
    async list(): Promise<ListEmployeesWithServiceAccountResponse> {
        return this.listEmployeesWithServiceAccount.execute();
    }
}

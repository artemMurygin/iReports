import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListEmployeesResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListEmployeesQueryDto } from '../dto/list-employees-query.dto';
import { ListEmployeesService } from '../../application/services/list-employees.service';

@ApiTags('Справочник: отделы и сотрудники')
@Controller()
export class ListEmployeesHttpController {
    constructor(private readonly listEmployees: ListEmployeesService) {}

    @Get(routesV1.directory.employees)
    @ApiOperation({
        summary:
            'Список сотрудников Bitrix, опционально отфильтрованный по отделу',
    })
    async list(
        @Query() query: ListEmployeesQueryDto,
    ): Promise<ListEmployeesResponse> {
        return this.listEmployees.execute(query.departmentId);
    }
}

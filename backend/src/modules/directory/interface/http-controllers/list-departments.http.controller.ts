import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ListDepartmentsResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { ListDepartmentsService } from '../../application/services/list-departments.service';

@ApiTags('Справочник: отделы и сотрудники')
@Controller()
export class ListDepartmentsHttpController {
    constructor(private readonly listDepartments: ListDepartmentsService) {}

    @Get(routesV1.directory.departments)
    @ApiOperation({ summary: 'Список отделов Bitrix' })
    async list(): Promise<ListDepartmentsResponse> {
        return this.listDepartments.execute();
    }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { routesV1 } from '@/config/app.routes';
import { EmployeeHoursEntryListQueryDto } from '../dto/employee-hours-entry-list-query.dto';
import { ListEmployeeHoursEntriesService } from '../../application/services/list-employee-hours-entries.service';

@ApiTags('Бухгалтерия: часы сотрудников')
@Controller()
export class ListEmployeeHoursEntriesHttpController {
    constructor(
        private readonly listEmployeeHoursEntries: ListEmployeeHoursEntriesService,
    ) {}

    @Get(routesV1.service.accounting.employeeHours)
    @ApiOperation({ summary: 'Записи отработанных часов за период' })
    async list(
        @Query() query: EmployeeHoursEntryListQueryDto,
    ): Promise<EmployeeHoursEntryResponse[]> {
        return this.listEmployeeHoursEntries.execute(
            query.period,
            query.employeeId,
        );
    }
}

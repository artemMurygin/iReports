import { Controller, Get, Query } from '@nestjs/common';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { EmployeeHoursEntryListQueryDto } from '../dto/employee-hours-entry-list-query.dto';
import { ListEmployeeHoursEntriesService } from '../../application/services/list-employee-hours-entries.service';

@Controller('accounting')
export class ListEmployeeHoursEntriesHttpController {
    constructor(
        private readonly listEmployeeHoursEntries: ListEmployeeHoursEntriesService,
    ) {}

    @Get('employee_hours')
    async list(
        @Query() query: EmployeeHoursEntryListQueryDto,
    ): Promise<EmployeeHoursEntryResponse[]> {
        return this.listEmployeeHoursEntries.execute(
            query.period,
            query.employeeId,
        );
    }
}

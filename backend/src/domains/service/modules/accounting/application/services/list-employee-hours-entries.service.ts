import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { EMPLOYEE_HOURS_ENTRY_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { toEmployeeHoursEntryResponse } from '@/domains/service/modules/accounting/application/mappers/to-employee-hours-entry-response';

// Список записей часов за период (руководитель/администратор смотрит и
// правит часы всех сотрудников месяца) либо запись одного сотрудника, если
// employeeId указан явно.
@Injectable()
export class ListEmployeeHoursEntriesService {
    constructor(
        @Inject(EMPLOYEE_HOURS_ENTRY_REPOSITORY)
        private readonly repo: EmployeeHoursEntryRepositoryPort,
    ) {}

    async execute(
        period: string,
        employeeId?: number,
    ): Promise<EmployeeHoursEntryResponse[]> {
        if (employeeId !== undefined) {
            const entry = await this.repo.findByEmployeeAndPeriod(
                employeeId,
                period,
            );
            return entry ? [toEmployeeHoursEntryResponse(entry)] : [];
        }

        const entries = await this.repo.findByPeriod(period);
        return entries.map(toEmployeeHoursEntryResponse);
    }
}

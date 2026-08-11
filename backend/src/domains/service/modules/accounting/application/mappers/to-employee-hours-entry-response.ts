import type { EmployeeHoursEntryResponse } from 'ireports-contracts';
import { EmployeeHoursEntry } from '@/domains/service/modules/accounting/domain/entities/employee-hours-entry.entity';

export function toEmployeeHoursEntryResponse(
    entry: EmployeeHoursEntry,
): EmployeeHoursEntryResponse {
    return {
        id: entry.id,
        employeeId: entry.employeeId,
        period: entry.period,
        hours: entry.hours,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
}

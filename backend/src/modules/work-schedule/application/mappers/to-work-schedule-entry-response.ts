import type { WorkScheduleEntryResponse } from 'ireports-contracts';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';

export function toWorkScheduleEntryResponse(
    entry: WorkScheduleEntry,
): WorkScheduleEntryResponse {
    return {
        id: entry.id,
        employeeId: entry.employeeId,
        date: entry.date.getValue(),
        status: entry.day.status,
        hours: entry.day.hours,
        role: entry.day.role,
        isOnDuty: entry.day.isOnDuty,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
}

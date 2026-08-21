import {
    WorkScheduleEntry as WorkScheduleEntryRecord,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';

export class WorkScheduleEntryMapper implements Mapper<
    WorkScheduleEntry,
    Prisma.WorkScheduleEntryCreateInput
> {
    toDomain(record: WorkScheduleEntryRecord): WorkScheduleEntry {
        return WorkScheduleEntry.reconstitute({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                employeeId: record.employeeId,
                date: ScheduleDate.fromDate(record.date),
                day: WorkDay.create({
                    status: record.status,
                    hours: record.hours,
                    role: record.role,
                }),
            },
        });
    }

    toPersistence(
        entity: WorkScheduleEntry,
    ): Prisma.WorkScheduleEntryCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            employeeId: entity.employeeId,
            date: entity.date.toDate(),
            status: entity.day.status,
            hours: entity.day.hours,
            role: entity.day.role,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}

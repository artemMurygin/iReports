import {
    EmployeeHoursEntry as EmployeeHoursEntryRecord,
    Prisma,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { EmployeeHoursEntry } from '@/domains/service/modules/accounting/domain/entities/employee-hours-entry.entity';

export class EmployeeHoursEntryMapper implements Mapper<
    EmployeeHoursEntry,
    Prisma.EmployeeHoursEntryCreateInput
> {
    toDomain(record: EmployeeHoursEntryRecord): EmployeeHoursEntry {
        return new EmployeeHoursEntry({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                employeeId: record.employeeId,
                period: record.period,
                hours: record.hours,
            },
        });
    }

    toPersistence(
        entity: EmployeeHoursEntry,
    ): Prisma.EmployeeHoursEntryCreateInput {
        return {
            id: entity.id,
            employeeId: entity.employeeId,
            period: entity.period,
            hours: entity.hours,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}

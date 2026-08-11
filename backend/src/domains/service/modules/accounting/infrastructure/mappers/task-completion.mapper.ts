import {
    Prisma,
    TaskCompletion as TaskCompletionRecord,
} from '../../../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import {
    TaskCompletion,
    TaskCompletionStatus,
} from '@/domains/service/modules/accounting/domain/entities/task-completion.entity';

export class TaskCompletionMapper implements Mapper<
    TaskCompletion,
    Prisma.TaskCompletionCreateInput
> {
    toDomain(record: TaskCompletionRecord): TaskCompletion {
        return new TaskCompletion({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                employeeId: record.employeeId,
                period: record.period,
                description: record.description,
                status: record.status as TaskCompletionStatus,
                createdBy: record.createdBy,
                confirmedBy: record.confirmedBy,
                confirmedAt: record.confirmedAt,
            },
        });
    }

    toPersistence(entity: TaskCompletion): Prisma.TaskCompletionCreateInput {
        return {
            id: entity.id,
            employeeId: entity.employeeId,
            period: entity.period,
            description: entity.description,
            status: entity.status,
            createdBy: entity.createdBy,
            confirmedBy: entity.confirmedBy,
            confirmedAt: entity.confirmedAt,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
}

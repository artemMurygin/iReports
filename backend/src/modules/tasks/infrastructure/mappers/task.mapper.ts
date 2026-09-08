import {
    Task as TaskRecord,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { Task } from '@/modules/tasks/domain/entities/task.entity';
import { TaskStatus } from '@/modules/tasks/domain/value-objects/task-status.value-object';

export class TaskMapper implements Mapper<Task, Prisma.TaskCreateInput> {
    toDomain(record: TaskRecord): Task {
        return Task.reconstitute({
            id: record.id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            props: {
                direction: record.direction as AccountingDirection | null,
                title: record.title,
                description: record.description,
                deadline: record.deadline,
                assigneeEmployeeId: record.assigneeEmployeeId,
                status: TaskStatus.fromCode(record.status),
                closedSuccessfullyAt: record.closedSuccessfullyAt,
            },
        });
    }

    toPersistence(entity: Task): Prisma.TaskCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            direction: entity.direction,
            title: entity.title,
            description: entity.description,
            deadline: entity.deadline,
            assigneeEmployeeId: entity.assigneeEmployeeId,
            status: entity.status.code,
            closedSuccessfullyAt: entity.closedSuccessfullyAt,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
        };
    }
}

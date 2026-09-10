import {
    TaskLink as TaskLinkRecord,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';
import { TaskLinkUrl } from '@/modules/tasks/domain/value-objects/task-link-url.value-object';

export class TaskLinkMapper implements Mapper<
    TaskLink,
    Prisma.TaskLinkCreateInput
> {
    toDomain(record: TaskLinkRecord): TaskLink {
        return TaskLink.reconstitute({
            id: record.id,
            createdAt: record.createdAt,
            props: {
                taskId: record.taskId,
                url: TaskLinkUrl.create(record.url),
                label: record.label,
            },
        });
    }

    toPersistence(entity: TaskLink): Prisma.TaskLinkCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            taskId: entity.taskId,
            url: entity.url.value,
            label: entity.label,
            createdAt: props.createdAt,
        };
    }
}

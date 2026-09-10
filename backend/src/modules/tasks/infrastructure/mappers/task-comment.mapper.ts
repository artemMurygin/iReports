import {
    TaskComment as TaskCommentRecord,
    Prisma,
} from '../../../../../prisma/generated/prisma/schema/client';
import { Mapper } from '@/shared/domain/mapper.interface';
import { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';
import { TaskCommentBody } from '@/modules/tasks/domain/value-objects/task-comment-body.value-object';

export class TaskCommentMapper implements Mapper<
    TaskComment,
    Prisma.TaskCommentCreateInput
> {
    toDomain(record: TaskCommentRecord): TaskComment {
        return TaskComment.reconstitute({
            id: record.id,
            createdAt: record.createdAt,
            props: {
                taskId: record.taskId,
                authorEmployeeId: record.authorEmployeeId,
                body: TaskCommentBody.create(record.body),
            },
        });
    }

    toPersistence(entity: TaskComment): Prisma.TaskCommentCreateInput {
        const props = entity.getProps();
        return {
            id: props.id,
            taskId: entity.taskId,
            authorEmployeeId: entity.authorEmployeeId,
            body: entity.text,
            createdAt: props.createdAt,
        };
    }
}

import { randomUUID } from 'crypto';
import {
    AggregateID,
    CreateEntityProps,
    Entity,
} from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { TaskCommentBody } from '../value-objects/task-comment-body.value-object';

// spec: tasks/comments#requirement-комментарий-фиксирует-автора-время-и-текст —
// комментарий к задаче: автор, момент создания, текст. По прецеденту
// Task/TaskLink — собственная сущность модуля tasks, БЕЗ @relation на
// Task/BitrixEmployee (design.md Decision 1), taskId/authorEmployeeId —
// обычные поля.
export interface TaskCommentProps {
    taskId: string;
    authorEmployeeId: number;
    body: TaskCommentBody;
}

export interface TaskCommentCreateProps {
    taskId: string;
    authorEmployeeId: number;
    text: string;
}

export class TaskComment extends Entity<TaskCommentProps> {
    declare protected readonly _id: AggregateID;

    static create(props: TaskCommentCreateProps): TaskComment {
        return new TaskComment({
            id: randomUUID(),
            props: {
                taskId: props.taskId,
                authorEmployeeId: props.authorEmployeeId,
                body: TaskCommentBody.create(props.text),
            },
        });
    }

    // Восстановление из персистентности — по прецеденту Task.reconstitute.
    static reconstitute(
        props: CreateEntityProps<TaskCommentProps>,
    ): TaskComment {
        return new TaskComment(props);
    }

    get taskId(): string {
        return this.props.taskId;
    }

    get authorEmployeeId(): number {
        return this.props.authorEmployeeId;
    }

    get body(): TaskCommentBody {
        return this.props.body;
    }

    get text(): string {
        return this.props.body.value;
    }

    validate(): void {
        if (!this.props.taskId || this.props.taskId.trim().length === 0) {
            throw new ArgumentInvalidException(
                'Комментарий должен ссылаться на задачу',
            );
        }
        if (
            !Number.isInteger(this.props.authorEmployeeId) ||
            this.props.authorEmployeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Необходимо указать корректного автора комментария',
            );
        }
    }
}

import { randomUUID } from 'crypto';
import {
    AggregateID,
    CreateEntityProps,
    Entity,
} from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { TaskLinkUrl } from '../value-objects/task-link-url.value-object';

// spec: tasks/links#requirement-задача-может-иметь-несколько-ссылок —
// ссылка на внешний материал, прикреплённая к задаче: адрес и опциональная
// подпись. По прецеденту Task/TaskComment — собственная сущность модуля
// tasks, БЕЗ @relation на Task (design.md Decision 1).
export interface TaskLinkProps {
    taskId: string;
    url: TaskLinkUrl;
    label: string | null;
}

export interface TaskLinkCreateProps {
    taskId: string;
    url: string;
    label?: string | null;
}

export class TaskLink extends Entity<TaskLinkProps> {
    declare protected readonly _id: AggregateID;

    static create(props: TaskLinkCreateProps): TaskLink {
        return new TaskLink({
            id: randomUUID(),
            props: {
                taskId: props.taskId,
                url: TaskLinkUrl.create(props.url),
                label: props.label ?? null,
            },
        });
    }

    // Восстановление из персистентности — по прецеденту Task.reconstitute.
    static reconstitute(props: CreateEntityProps<TaskLinkProps>): TaskLink {
        return new TaskLink(props);
    }

    get taskId(): string {
        return this.props.taskId;
    }

    get url(): TaskLinkUrl {
        return this.props.url;
    }

    get label(): string | null {
        return this.props.label;
    }

    validate(): void {
        if (!this.props.taskId || this.props.taskId.trim().length === 0) {
            throw new ArgumentInvalidException(
                'Ссылка должна ссылаться на задачу',
            );
        }
    }
}

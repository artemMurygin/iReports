import { ValueObject } from '@/shared/domain/value-object.base';
import { TaskCommentBodyEmptyException } from '../exceptions/task.exception';

// spec: tasks/comments#requirement-пустой-комментарий-отклоняется — текст
// комментария самовалидируется здесь: пустая строка или строка из одних
// пробелов не становится валидным TaskCommentBody, по прецеденту
// PermissionCode/ScheduleDate (static create + throw в конструкторе-
// фабрике, а не в base ValueObject).
export class TaskCommentBody extends ValueObject<string> {
    static create(text: string): TaskCommentBody {
        if (!text || text.trim().length === 0) {
            throw new TaskCommentBodyEmptyException(
                'Текст комментария не может быть пустым',
            );
        }
        return new TaskCommentBody({ value: text });
    }

    get value(): string {
        return this.unpack();
    }
}

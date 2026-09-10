import { ValueObject } from '@/shared/domain/value-object.base';
import { InvalidTaskLinkUrlException } from '../exceptions/task.exception';

// spec: tasks/links#requirement-ссылка-должна-быть-валидным-адресом —
// адрес самовалидируется здесь как синтаксически корректный URL (через
// встроенный URL-парсер), по тому же приёму, что и TaskCommentBody/
// PermissionCode/ScheduleDate.
export class TaskLinkUrl extends ValueObject<string> {
    static create(value: string): TaskLinkUrl {
        if (!value || !TaskLinkUrl.isSyntacticallyValid(value)) {
            throw new InvalidTaskLinkUrlException(
                `Ссылка должна быть синтаксически валидным адресом, получено: "${value}"`,
            );
        }
        return new TaskLinkUrl({ value });
    }

    get value(): string {
        return this.unpack();
    }

    private static isSyntacticallyValid(value: string): boolean {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }
}

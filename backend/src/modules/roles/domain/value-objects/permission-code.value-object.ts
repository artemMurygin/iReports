import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// resource и action: lowercase-слова через дефис, разделены двоеточием
// (proposal.md: `reports:view`, `reports:edit`, `users:manage`,
// `roles:manage`). Формат самовалидируется здесь — опечатка вида
// "role:manage" вместо "roles:manage" ловится там, где строка впервые
// оборачивается в PermissionCode, а не тихо не срабатывает в рантайме
// (design.md, Decision 12).
const PERMISSION_CODE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+(-[a-z0-9]+)*$/;

export class PermissionCode extends ValueObject<string> {
    static create(value: string): PermissionCode {
        if (!value || !PERMISSION_CODE_PATTERN.test(value)) {
            throw new ArgumentInvalidException(
                `Permission-код должен быть в формате "resource:action" (строчные буквы/цифры/дефисы), получено: "${value}"`,
            );
        }

        return new PermissionCode({ value });
    }
}

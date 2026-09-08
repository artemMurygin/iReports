import {
    ArgumentInvalidException,
    ConflictException,
    NotFoundException,
} from '@/shared/exceptions';

export class RoleNotFoundException extends NotFoundException {
    constructor(message = 'Роль не найдена') {
        super(message);
    }
}

// Два имени роли не могут совпадать (spec: roles#model-role-permission —
// UI/API управляет ролями, не допуская коллизий имён).
export class RoleNameAlreadyExistsException extends ConflictException {}

// Системную роль (Role.isSystem, засеиваемую миграцией — design.md,
// Decision 9) нельзя удалить через API: иначе после удаления Administrator
// некому будет управлять ролями (bootstrap первого администратора).
export class SystemRoleCannotBeDeletedException extends ConflictException {}

// Permission-код, отсутствующий в каталоге (наполняется ТОЛЬКО
// PermissionsCatalogSeeder из реестра кода — design.md, Decision 12), не
// может быть назначен роли ни при создании, ни при обновлении прав (spec:
// roles#permission-catalog-from-code).
export class PermissionCodeNotInCatalogException extends ArgumentInvalidException {}

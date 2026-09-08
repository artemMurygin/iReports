import { randomUUID } from 'crypto';
import { AggregateID } from '@/shared/domain/entity.base';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { PermissionCode } from '../value-objects/permission-code.value-object';

export interface RoleProps {
    name: string;
    isSystem: boolean;
    permissionCodes: string[];
}

export interface RoleCreateProps {
    name: string;
    isSystem?: boolean;
    permissionCodes?: string[];
}

// Именованный набор permissions (design.md, Decision 1/12) — роль и
// назначение ей permissions ИЗ существующего каталога управляются через
// UI/API без деплоя (spec: roles#model-role-permission). isSystem — признак
// роли Administrator, засеиваемой миграцией (design.md, Decision 9,
// bootstrap первого администратора) — такую роль нельзя удалить (см.
// RolesCommandHandlers.deleteRole).
export class Role extends AggregateRoot<RoleProps> {
    declare protected readonly _id: AggregateID;

    static create(create: RoleCreateProps): Role {
        const permissionCodes = create.permissionCodes ?? [];
        // Формат каждого кода проверяется здесь (PermissionCode
        // самовалидируется) — принадлежность коду каталогу Permission
        // (design.md, Decision 12) проверяет вызывающий application-слой
        // (RolesCommandHandlers), у сущности нет доступа к репозиторию
        // каталога.
        permissionCodes.forEach((code) => PermissionCode.create(code));

        return new Role({
            id: randomUUID(),
            props: {
                name: create.name,
                isSystem: create.isSystem ?? false,
                permissionCodes: [...new Set(permissionCodes)],
            },
        });
    }

    get name(): string {
        return this.props.name;
    }

    get isSystem(): boolean {
        return this.props.isSystem;
    }

    get permissionCodes(): string[] {
        return [...this.props.permissionCodes];
    }

    // Переименование роли — уникальность name проверяет application-слой
    // (обращение к репозиторию), сама сущность отвечает только за то, что
    // новое имя непустое (spec: roles#model-role-permission).
    rename(name: string): void {
        this.props.name = name;
        this.validate();
    }

    // Полная замена набора permissions роли (не патч по одному коду) —
    // соответствует матрице "роль × permission" на админ-странице, которая
    // сохраняет весь набор чекбоксов разом (spec: roles#immediate-permission-changes,
    // PATCH /roles/:id/permissions).
    updatePermissions(permissionCodes: string[]): void {
        permissionCodes.forEach((code) => PermissionCode.create(code));
        this.props.permissionCodes = [...new Set(permissionCodes)];
    }

    validate(): void {
        if (!this.props.name || !this.props.name.trim()) {
            throw new ArgumentInvalidException(
                'Название роли не может быть пустым',
            );
        }
    }
}

import { Inject, Injectable } from '@nestjs/common';
import { Role } from '../../domain/entities/role.entity';
import {
    PermissionCodeNotInCatalogException,
    RoleNameAlreadyExistsException,
    RoleNotFoundException,
    SystemRoleCannotBeDeletedException,
} from '../../domain/exceptions/role.exception';
import {
    ROLE_REPOSITORY,
    type RoleRepositoryPort,
} from '../ports/role.repository.port';
import {
    PERMISSION_CATALOG_REPOSITORY,
    type PermissionCatalogRepositoryPort,
} from '../ports/permission-catalog.port';
import {
    SESSION_PORT,
    type SessionPort,
} from '@/modules/session/application/ports/session.port';
import { PermissionsResolverAdapter } from '../../infrastructure/permissions-resolver.adapter';

// CRUD ролей (spec: roles#model-role-permission) + каталог permission-
// кодов, ИЗ которого роли могут получать права, но который сам не
// создаётся через API (spec: roles#permission-catalog-from-code, design.md
// Decision 12) + назначение ролей сотрудникам и немедленное применение
// изменений прав роли к активным сессиям (spec:
// roles#immediate-permission-changes). Единый класс с несколькими методами
// (не отдельный Command+Handler на каждое действие, как в employee-identity)
// — так называет их architecture.md ("RolesCommandHandlers"), а сами
// операции — простые CRUD/связующие сценарии без нужды в шине команд.
//
// PermissionsResolverAdapter инжектируется напрямую конкретным классом, а
// не через PERMISSIONS_RESOLVER_PORT — это тот же модуль-владелец порта
// (design.md, Decision 1: потребитель порта через Symbol-токен — только
// ВНЕШНИЙ модуль `auth`), лишняя косвенность внутри одного модуля не нужна.
@Injectable()
export class RolesCommandHandlers {
    constructor(
        @Inject(ROLE_REPOSITORY)
        private readonly roleRepository: RoleRepositoryPort,
        @Inject(PERMISSION_CATALOG_REPOSITORY)
        private readonly catalogRepository: PermissionCatalogRepositoryPort,
        @Inject(SESSION_PORT)
        private readonly sessionPort: SessionPort,
        private readonly permissionsResolver: PermissionsResolverAdapter,
    ) {}

    async createRole(
        name: string,
        permissionCodes: string[] = [],
    ): Promise<Role> {
        await this.ensureNameIsFree(name);
        await this.ensureCodesExistInCatalog(permissionCodes);

        const role = Role.create({ name, permissionCodes });
        await this.roleRepository.insert(role);

        return role;
    }

    async renameRole(roleId: string, name: string): Promise<Role> {
        const role = await this.findRoleOrThrow(roleId);
        await this.ensureNameIsFree(name, roleId);

        role.rename(name);
        await this.roleRepository.save(role);

        return role;
    }

    async deleteRole(roleId: string): Promise<void> {
        const role = await this.findRoleOrThrow(roleId);

        // Системную роль Administrator (design.md, Decision 9) нельзя
        // удалить — иначе некому будет назначать роли/права дальше.
        if (role.isSystem) {
            throw new SystemRoleCannotBeDeletedException(
                `Системную роль "${role.name}" нельзя удалить`,
            );
        }

        await this.roleRepository.delete(roleId);
    }

    // Многие-ко-многим EmployeeRole (spec: roles#model-role-permission).
    // Немедленный push permissions в активные сессии здесь не требуется —
    // spec (roles#immediate-permission-changes) описывает только изменение
    // прав уже назначенной роли, не сам факт назначения/снятия роли.
    async assignRoleToEmployee(
        bitrixEmployeeId: number,
        roleId: string,
    ): Promise<void> {
        await this.findRoleOrThrow(roleId);
        await this.roleRepository.assignToEmployee(bitrixEmployeeId, roleId);
    }

    // Идемпотентно (см. RoleRepository.revokeFromEmployee) — снятие роли,
    // которая уже не назначена, не считается ошибкой.
    async revokeRoleFromEmployee(
        bitrixEmployeeId: number,
        roleId: string,
    ): Promise<void> {
        await this.roleRepository.revokeFromEmployee(bitrixEmployeeId, roleId);
    }

    // Полная замена набора permissions роли + немедленный push
    // пересчитанных permissions во все активные сессии сотрудников этой
    // роли (spec: roles#immediate-permission-changes — снятое право
    // перестаёт действовать без релогина). Пересчёт идёт через
    // PermissionsResolverAdapter (не просто новый набор роли), потому что у
    // сотрудника может быть несколько ролей одновременно — сессия должна
    // получить объединение прав ВСЕХ его ролей, а не только этой.
    async updateRolePermissions(
        roleId: string,
        permissionCodes: string[],
    ): Promise<Role> {
        const role = await this.findRoleOrThrow(roleId);
        await this.ensureCodesExistInCatalog(permissionCodes);

        role.updatePermissions(permissionCodes);
        await this.roleRepository.save(role);

        const employeeIds =
            await this.roleRepository.findEmployeeIdsByRoleId(roleId);
        await Promise.all(
            employeeIds.map(async (employeeId) => {
                const permissions =
                    await this.permissionsResolver.resolvePermissions(
                        employeeId,
                    );
                await this.sessionPort.refreshPermissionsForEmployee(
                    employeeId,
                    permissions,
                );
            }),
        );

        return role;
    }

    protected async findRoleOrThrow(roleId: string): Promise<Role> {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
            throw new RoleNotFoundException();
        }
        return role;
    }

    private async ensureNameIsFree(
        name: string,
        ignoreRoleId?: string,
    ): Promise<void> {
        const existing = await this.roleRepository.findByName(name);
        if (existing && existing.id !== ignoreRoleId) {
            throw new RoleNameAlreadyExistsException(
                `Роль с названием "${name}" уже существует`,
            );
        }
    }

    // Роль может ссылаться только на коды ИЗ уже существующего каталога
    // Permission (наполняется исключительно PermissionsCatalogSeeder из
    // реестра кода) — ни при создании роли, ни при последующем изменении
    // её прав нельзя сослаться на несуществующий код (spec:
    // roles#permission-catalog-from-code).
    protected async ensureCodesExistInCatalog(
        codes: string[],
    ): Promise<void> {
        if (codes.length === 0) {
            return;
        }

        const found = await this.catalogRepository.findManyByCodes(codes);
        const foundCodes = new Set(found.map((entry) => entry.code));
        const unknown = codes.filter((code) => !foundCodes.has(code));

        if (unknown.length > 0) {
            throw new PermissionCodeNotInCatalogException(
                `Permission-код(ы) отсутствуют в каталоге: ${unknown.join(', ')}`,
            );
        }
    }
}

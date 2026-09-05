import { Role } from '../../domain/entities/role.entity';

// Порт персистентности агрегата Role (design.md, Decision 1) — владелец
// src/modules/roles, потребитель — RolesCommandHandlers/RolesQueryHandlers
// (раздел 9-10 tasks.md).
export interface RoleRepositoryPort {
    insert(role: Role): Promise<void>;
    // Полное сохранение изменений агрегата (rename/updatePermissions) —
    // Role не патчит поля по отдельности на уровне БД, сохраняет целиком.
    save(role: Role): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<Role | null>;
    findByName(name: string): Promise<Role | null>;
    findAll(): Promise<Role[]>;

    // Многие-ко-многим EmployeeRole (spec: roles#model-role-permission).
    assignToEmployee(bitrixEmployeeId: number, roleId: string): Promise<void>;
    revokeFromEmployee(
        bitrixEmployeeId: number,
        roleId: string,
    ): Promise<void>;

    // Все сотрудники, у которых есть эта роль — вход для push новых
    // permissions во все их активные сессии после updateRolePermissions
    // (spec: roles#immediate-permission-changes).
    findEmployeeIdsByRoleId(roleId: string): Promise<number[]>;

    // Есть ли у сотрудника хотя бы одна назначенная роль — вход для
    // bootstrap первого администратора (design.md, Decision 9, раздел 11
    // tasks.md): REST-вызов Bitrix24 user.admin имеет смысл только для
    // сотрудников без единой роли.
    hasAnyRole(bitrixEmployeeId: number): Promise<boolean>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

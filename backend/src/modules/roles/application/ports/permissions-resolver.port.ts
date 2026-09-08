// Владелец — src/modules/roles (design.md, Decision 1). Потребитель —
// оркестрация логина в src/modules/auth (посчитать permissions прямо перед
// созданием сессии). Реализация — PermissionsResolverAdapter (раздел 8
// tasks.md), регистрируется в RolesModule.
export interface PermissionsResolverPort {
    resolvePermissions(bitrixEmployeeId: number): Promise<string[]>;
}

export const PERMISSIONS_RESOLVER_PORT = Symbol('PERMISSIONS_RESOLVER_PORT');

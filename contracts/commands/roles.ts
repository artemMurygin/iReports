import { z } from 'zod';

// Модель данных Role-Permission (add-bitrix24-auth-and-rbac,
// openspec/changes/add-bitrix24-auth-and-rbac/specs/roles/spec.md) —
// связана с существующим BitrixEmployee (design.md, Decision 2), не с новой
// сущностью User. permissionCode — формат "resource:action", та же
// регулярка, что и у доменного PermissionCode
// (backend/src/modules/roles/domain/value-objects/permission-code.value-object.ts),
// продублирована здесь намеренно: контракт валидирует форму запроса
// независимо от backend (nestjs-zod), backend всё равно самовалидирует через
// VO при создании/обновлении Role.
const permissionCodePattern = /^[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+(-[a-z0-9]+)*$/;
const permissionCodeSchema = z
    .string()
    .regex(
        permissionCodePattern,
        'Permission-код должен быть в формате "resource:action"',
    );

// ========================== Role ========================== //

const roleResponseSchema = z.object({
    id: z.string(),
    name: z.string(),
    // Системная роль Administrator (design.md, Decision 9) — не может быть
    // удалена (spec: roles#model-role-permission), UI показывает бейдж
    // «Системная» вместо действия удаления (ui-design.md).
    isSystem: z.boolean(),
    permissionCodes: z.array(permissionCodeSchema),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
});
export type RoleResponse = z.infer<typeof roleResponseSchema>;

const listRolesResponseSchema = z.array(roleResponseSchema);
export type ListRolesResponse = z.infer<typeof listRolesResponseSchema>;

// permissionCodes — опционально: роль можно создать сразу с набором прав ИЗ
// каталога одним вызовом (spec: roles#model-role-permission, сценарий "новая
// роль с набором прав создаётся без деплоя").
const createRoleRequestSchema = z.object({
    name: z.string().min(1),
    permissionCodes: z.array(permissionCodeSchema).optional(),
});
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;

const renameRoleRequestSchema = z.object({
    name: z.string().min(1),
});
export type RenameRoleRequest = z.infer<typeof renameRoleRequestSchema>;

// Полная замена набора permissions роли (не патч по одному коду) — совпадает
// с тем, как матрица "роль × permission" на UI сохраняет весь набор чекбоксов
// разом (spec: roles#immediate-permission-changes, PATCH /roles/:id/permissions).
const updateRolePermissionsRequestSchema = z.object({
    permissionCodes: z.array(permissionCodeSchema),
});
export type UpdateRolePermissionsRequest = z.infer<
    typeof updateRolePermissionsRequestSchema
>;

// ========================== Каталог permission-кодов ========================== //

// Каталог формируется ТОЛЬКО из типизированного реестра кода
// (PermissionsCatalogSeeder, design.md Decision 12) — этот контракт целиком
// read-only, ни одно поле не может быть отправлено обратно как запрос на
// создание нового кода (spec: roles#permission-catalog-from-code).
const permissionCatalogItemSchema = z.object({
    code: permissionCodeSchema,
    label: z.string(),
    group: z.string(),
});
export type PermissionCatalogItem = z.infer<typeof permissionCatalogItemSchema>;

const listPermissionsCatalogResponseSchema = z.array(
    permissionCatalogItemSchema,
);
export type ListPermissionsCatalogResponse = z.infer<
    typeof listPermissionsCatalogResponseSchema
>;

// ========================== Назначения роль↔сотрудник ========================== //

// Раздел 22 tasks.md (add-bitrix24-auth-and-rbac) — данные о назначениях
// ролей сотрудникам для таблицы «Сотрудники» на админ-странице ролей
// (spec: roles#model-role-permission, EmployeeRole many-to-many). Только
// сотрудники, у которых есть хотя бы одна роль — read-only, без мутаций.
const roleAssignmentSchema = z.object({
    employeeId: z.number(),
    roleIds: z.array(z.string()),
});
export type RoleAssignment = z.infer<typeof roleAssignmentSchema>;

const listRoleAssignmentsResponseSchema = z.array(roleAssignmentSchema);
export type ListRoleAssignmentsResponse = z.infer<
    typeof listRoleAssignmentsResponseSchema
>;

export {
    permissionCodeSchema,
    roleResponseSchema,
    listRolesResponseSchema,
    createRoleRequestSchema,
    renameRoleRequestSchema,
    updateRolePermissionsRequestSchema,
    permissionCatalogItemSchema,
    listPermissionsCatalogResponseSchema,
    roleAssignmentSchema,
    listRoleAssignmentsResponseSchema,
};

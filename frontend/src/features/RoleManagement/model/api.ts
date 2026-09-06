import { queryOptions } from '@tanstack/react-query'
import type {
    CreateRoleRequest,
    ListDepartmentsResponse,
    ListEmployeesResponse,
    ListPermissionsCatalogResponse,
    ListRoleAssignmentsResponse,
    ListRolesResponse,
    RenameRoleRequest,
    RoleResponse,
    UpdateRolePermissionsRequest,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `features/RoleManagement`: "`api.ts` (CRUD ролей, матрица прав,
 * назначение/снятие ролей — запросы и мутации; список сотрудников — через
 * уже существующий `GET /directory/employees`)". Мутирующие запросы (create/
 * rename/delete/updatePermissions/assign/revoke) проходят через CSRF
 * double-submit (`CsrfGuard` на бэкенде, раздел 13) — заголовок
 * `x-csrf-token` подставляется axios-интерцептором в
 * `shared/api/axios.instance.ts`, не здесь (тот же приём, что и
 * `features/Auth/model/api.ts`'s `logout`).
 *
 * Восемь из десяти эндпоинтов и их пути — `backend/src/config/app.routes.ts`'s
 * `routesV1.roles`, реализация раздела 12 tasks.md; DTO/ответы — `contracts/
 * commands/roles.ts`. `getRoleAssignments` — девятый, `routesV1.roles.assignments`
 * из раздела 22 tasks.md. `getDepartments` — существующий эндпоинт модуля
 * `directory` (`routesV1.directory`), не `roles`, переиспользован здесь ради
 * колонки «Отдел» на вкладке «Сотрудники» (раздел 20.7).
 */

export const ROLES_QUERY_KEY = ['roles', 'list'] as const

// Каталог формируется ТОЛЬКО из типизированного реестра кода
// (PermissionsCatalogSeeder, design.md Decision 12; spec:
// roles#permission-catalog-from-code) — этот запрос read-only, у api.ts
// этого модуля намеренно нет метода "создать/удалить permission-код".
// staleTime длиннее, чем у ROLES_QUERY_KEY: каталог меняется только деплоем
// кода, а не действиями пользователя в рамках сессии.
export const PERMISSIONS_CATALOG_QUERY_KEY = ['roles', 'permissions-catalog'] as const

// Раздел 20.7 tasks.md (add-bitrix24-auth-and-rbac) — назначения роль<->сотрудник для вкладки
// «Сотрудники» (`useEmployeeRoleAssignment`), эндпоинт раздела 22 (`GET /v1/roles/assignments`).
// Отдельный ключ от `ROLES_QUERY_KEY`: список ролей и назначения ролей сотрудникам меняются
// независимо (CRUD роли не трогает назначения, assign/revoke не трогает сам список ролей).
export const ROLE_ASSIGNMENTS_QUERY_KEY = ['roles', 'assignments'] as const

export const api = {
    getRoles: () =>
        queryOptions({
            queryKey: ROLES_QUERY_KEY,
            queryFn: ({ signal }): Promise<ListRolesResponse> =>
                apiInstance
                    .get<ListRolesResponse>('/v1/roles', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить список ролей'))
                    }),
        }),

    getPermissionsCatalog: () =>
        queryOptions({
            queryKey: PERMISSIONS_CATALOG_QUERY_KEY,
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListPermissionsCatalogResponse> =>
                apiInstance
                    .get<ListPermissionsCatalogResponse>('/v1/roles/permissions', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить каталог прав'))
                    }),
        }),

    // Список сотрудников для вкладки "Сотрудники" (`useEmployeeRoleAssignment`)
    // — существующий справочник `directory`, НЕ отдельный эндпоинт модуля
    // `roles` (design.md Decision 1; architecture.md `useEmployeeRoleAssignment`).
    // Без фильтра по отделу — вся страница должна видеть всех сотрудников
    // компании разом (та же форма запроса, что и `pages/EmployeeIdentity/model/
    // api.ts`'s `getEmployees`, но без `/service-accounts`: здесь не нужны
    // служебные аккаунты — они не являются пользователями iReports).
    getEmployees: () =>
        queryOptions({
            queryKey: ['roles', 'employees'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListEmployeesResponse> =>
                apiInstance
                    .get<ListEmployeesResponse>('/v1/directory/employees', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить список сотрудников'))
                    }),
        }),

    // Назначения роль<->сотрудник (раздел 22 tasks.md) — read-only, питает бейджи ролей и
    // состояние «Роль не назначена» в таблице сотрудников (ui-design.md фрейм `F6d3a`).
    getRoleAssignments: () =>
        queryOptions({
            queryKey: ROLE_ASSIGNMENTS_QUERY_KEY,
            queryFn: ({ signal }): Promise<ListRoleAssignmentsResponse> =>
                apiInstance
                    .get<ListRoleAssignmentsResponse>('/v1/roles/assignments', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить назначения ролей'))
                    }),
        }),

    // Названия отделов для колонки «Отдел» на вкладке «Сотрудники» — тот же существующий
    // справочник `directory`, что и `getEmployees` выше (`GET /directory/employees` отдаёт
    // только `departmentId`, без имени отдела; `pages/EmployeeIdentity/model/api.ts`'s
    // `getDepartments` уже делает ровно этот же запрос для той же цели).
    getDepartments: () =>
        queryOptions({
            queryKey: ['roles', 'departments'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListDepartmentsResponse> =>
                apiInstance
                    .get<ListDepartmentsResponse>('/v1/directory/departments', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить список отделов'))
                    }),
        }),

    // Мутации — обычные async-функции (не queryOptions), разворачиваются в
    // useMutation в хуках этого же model/ (frontend/CLAUDE.md, «Query options
    // factory» — фабрика только для чтения).
    createRole: (payload: CreateRoleRequest): Promise<RoleResponse> =>
        apiInstance
            .post<RoleResponse>('/v1/roles', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось создать роль'))
            }),

    renameRole: (id: string, payload: RenameRoleRequest): Promise<RoleResponse> =>
        apiInstance
            .patch<RoleResponse>(`/v1/roles/${id}`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось переименовать роль'))
            }),

    // Системную роль Administrator backend отклоняет
    // (SystemRoleCannotBeDeletedException, design.md Decision 9) — сообщение
    // сервера доезжает до пользователя через extractApiErrorMessage вместо
    // общего текста.
    deleteRole: (id: string): Promise<void> =>
        apiInstance
            .delete(`/v1/roles/${id}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось удалить роль'))
            }),

    // Полная замена набора permissions роли (не патч по одному коду, spec:
    // roles#immediate-permission-changes) — совпадает с тем, как матрица
    // "роль × permission" сохраняет весь набор чекбоксов разом.
    updateRolePermissions: (id: string, payload: UpdateRolePermissionsRequest): Promise<RoleResponse> =>
        apiInstance
            .patch<RoleResponse>(`/v1/roles/${id}/permissions`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось сохранить права роли'))
            }),

    assignRoleToEmployee: (roleId: string, employeeId: number): Promise<void> =>
        apiInstance
            .post(`/v1/roles/${roleId}/employees/${employeeId}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось назначить роль сотруднику'))
            }),

    revokeRoleFromEmployee: (roleId: string, employeeId: number): Promise<void> =>
        apiInstance
            .delete(`/v1/roles/${roleId}/employees/${employeeId}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось снять роль с сотрудника'))
            }),
}

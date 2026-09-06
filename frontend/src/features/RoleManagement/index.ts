// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что уже задокументирован в
// features/SalesPlan, features/AccountingPeriod, features/TargetDirectory,
// features/SalaryReportData.
//
// РЕШЕНИЕ (раздел 20 tasks.md, продолжает ОТКРЫТЫЙ ВОПРОС раздела 19):
// architecture.md называет публичным API фичи единственный корневой компонент
// `RoleManagementPanel`, но ни tasks.md (раздел 20), ни ui-design.md такой
// компонент не описывают — раздел 20 явно создаёт три независимых
// UI-компонента (`ui/RoleList`, `ui/RolePermissionMatrix`,
// `ui/EmployeeRoleAssignment`, последний ещё не реализован — см. финальный
// отчёт раздела 20), которые `pages/RolesManagement` сам переключает по
// вкладкам через собственный презентационный компонент
// (`pages/RolesManagement/ui/RolesAndPermissionsTab`, а не мediator
// напрямую — frontend/CLAUDE.md, «Медиатор не должен содержать условного
// рендера»). Считаем формулировку architecture.md про единственный
// `RoleManagementPanel` устаревшей и экспортируем отсюда все публичные
// UI-компоненты фичи по отдельности, как уже сделано для модели.
export { useRoles } from './model/useRoles.ts'
export { useRolePermissionsMatrix } from './model/useRolePermissionsMatrix.ts'
export type { PermissionMatrixCell, PermissionMatrixRole } from './model/useRolePermissionsMatrix.ts'
export { useEmployeeRoleAssignment } from './model/useEmployeeRoleAssignment.ts'
export { ROLES_QUERY_KEY, PERMISSIONS_CATALOG_QUERY_KEY } from './model/api.ts'
export { RoleList } from './ui/RoleList/RoleList.tsx'
export { CreateRoleModal } from './ui/RoleList/CreateRoleModal.tsx'
export { RolePermissionMatrix } from './ui/RolePermissionMatrix/RolePermissionMatrix.tsx'

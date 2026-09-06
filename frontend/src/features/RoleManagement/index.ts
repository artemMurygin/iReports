// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что уже задокументирован в
// features/SalesPlan, features/AccountingPeriod, features/TargetDirectory,
// features/SalaryReportData: на момент этого коммита (раздел 19 tasks.md) у
// фичи есть только модель (`model/api.ts` + хуки) — UI (`ui/RoleList`,
// `ui/RolePermissionMatrix`, `ui/EmployeeRoleAssignment`) добавляется
// следующим разделом (20) и будет реэкспортирован отсюда же, когда появится.
//
// ОТКРЫТЫЙ ВОПРОС (см. финальный отчёт раздела 19): architecture.md называет
// публичным API фичи единственный корневой компонент `RoleManagementPanel`,
// но ни tasks.md (раздел 20), ни ui-design.md такой компонент не описывают —
// раздел 20 создаёт три независимых UI-компонента, которые
// `pages/RolesManagement/mediator/RolesManagementPage` сам переключает по
// вкладкам. Здесь это не решалось самостоятельно (архитектурное решение вне
// раздела 19) — секции 20 нужно либо ввести `RoleManagementPanel` как
// обёртку, либо считать это устаревшей формулировкой architecture.md и
// экспортировать отсюда три UI-компонента по отдельности, как ниже уже
// сделано для модели.
export { useRoles } from './model/useRoles.ts'
export { useRolePermissionsMatrix } from './model/useRolePermissionsMatrix.ts'
export type { PermissionMatrixCell, PermissionMatrixRole } from './model/useRolePermissionsMatrix.ts'
export { useEmployeeRoleAssignment } from './model/useEmployeeRoleAssignment.ts'
export { ROLES_QUERY_KEY, PERMISSIONS_CATALOG_QUERY_KEY } from './model/api.ts'

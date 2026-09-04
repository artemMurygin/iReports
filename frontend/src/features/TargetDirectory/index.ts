// Отклонение от стандартной конвенции index.ts ("реэкспортирует только корневой UI-компонент
// фичи", см. frontend/CLAUDE.md): у этой фичи нет UI вовсе — только справочные данные (отделы/
// сотрудники Bitrix), переиспользуемые Шагом 1 создания схемы (pages/SalaryRules) и фильтрами
// списка схем (pages/SalaryRuleList). Тот же прецедент уже задокументирован в
// features/SalesPlan/index.ts.
export { useDepartments, useEmployees } from './model/useTargetDirectory.ts'
export type { TargetOption } from './model/types.ts'
export { EMPLOYEES_QUERY_KEY } from './model/api.ts'

// Признак увольнения сотрудника на момент закрытия периода (PRD 1
// docs/payroll-closing-and-accrual: "isDismissed — по статусу активности
// сотрудника в Bitrix24 на момент закрытия"). Источник — BitrixEmployee.isActive
// (bitrix.prisma), синхронизируемый BitrixSyncService.uploadEmployees().
// Сквозной модуль вне domains/service и domains/shop (см.
// backend/CLAUDE.md, modules/directory, modules/employee-identity как
// образец): признак читает общекорпоративные данные Bitrix24, а не
// бизнес-логику ни одного из двух доменов, и обе direction-реализации
// (service/shop) используют одну и ту же direction-агностичную реализацию.
export interface EmployeeDismissalPort {
    // Подмножество переданных id, у которых сотрудник неактивен в Bitrix24.
    // Неизвестный справочнику сотрудник уволенным не считается.
    findDismissedEmployeeIds(employeeIds: number[]): Promise<Set<number>>;
}

export const EMPLOYEE_DISMISSAL = Symbol('EMPLOYEE_DISMISSAL');

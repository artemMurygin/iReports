// Признак увольнения сотрудника на момент закрытия периода (PRD 1
// docs/payroll-closing-and-accrual: "isDismissed — по статусу активности
// сотрудника в Bitrix24 на момент закрытия"). Источник — BitrixEmployee.isActive
// (bitrix.prisma), синхронизируемый BitrixSyncService.uploadEmployees().
// Отдельный узкий порт, а не поле ServiceCalculationDataPort/DirectoryRepositoryPort:
// признак нужен только закрытию периода, и оба домена (service/shop)
// используют одну и ту же direction-агностичную реализацию.
export interface EmployeeDismissalPort {
    // Подмножество переданных id, у которых сотрудник неактивен в Bitrix24.
    // Неизвестный справочнику сотрудник уволенным не считается.
    findDismissedEmployeeIds(employeeIds: number[]): Promise<Set<number>>;
}

export const EMPLOYEE_DISMISSAL = Symbol('EMPLOYEE_DISMISSAL');

// Справочник Bitrix (отделы/сотрудники) — минимум полей, нужный селектам
// «Отдел»/«Сотрудник» на Шаге 1 формы создания зарплатной схемы
// (docs/salary-schema-creation-ui, Фаза 1). Порт называет форму явно, а не
// одалживает BitrixDepartment/BitrixEmployee из Prisma — тот же приём, что
// и BitrixEmployeeSummary в modules/employee-identity.
export interface DepartmentSummary {
    id: number;
    name: string;
}

export interface EmployeeSummary {
    id: number;
    firstName: string;
    lastName: string;
    departmentId: number;
    // Должность (BitrixEmployee.position) — опционально: нужна только
    // сквозному списку взаиморасчётов (docs/employee-settlements-page-redesign,
    // Фаза 1, GET /v1/accounting/balance/summary/:period), остальные
    // потребители DirectoryRepositoryPort её не читают, поэтому поле
    // необязательное — не ломает существующие фейки/реализации порта.
    // undefined у фейков, где поле не заполняется, null — реальная запись
    // Bitrix24 без подтянутой должности.
    position?: string | null;
}

export interface DirectoryRepositoryPort {
    findDepartments(): Promise<DepartmentSummary[]>;
    // departmentId не передан (undefined) — сотрудники всех отделов.
    findEmployees(departmentId?: number): Promise<EmployeeSummary[]>;
}

export const DIRECTORY_REPOSITORY = Symbol('DIRECTORY_REPOSITORY');

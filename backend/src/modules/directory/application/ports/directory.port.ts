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
    // Признак «служебный аккаунт» (BitrixEmployee.isServiceAccount,
    // docs/employee-ordering-and-salary-filter, Фаза 3) — опционально по
    // тому же принципу, что и position: нужен только эндпоинту
    // включения/выключения признака (toEmployeeWithServiceAccountResponse) и
    // фильтрации схем мотивации по служебным целям (ListMotivationSchemasService/
    // ResolveEmployeeSalaryRulesService.forAllTargets — через
    // findServiceAccountEmployeeIds ниже, не через это поле напрямую).
    // Собственно ФИЛЬТРАЦИЯ findEmployees() по умолчанию не зависит от того,
    // выбрано ли это поле, — см. FindEmployeesOptions.
    isServiceAccount?: boolean;
}

// По умолчанию (includeServiceAccounts не передан либо false) findEmployees
// исключает сотрудников с isServiceAccount: true — этим методом питаются все
// зарплатные списки/справочники (сам справочник выбора сотрудника при
// создании отчёта, взаиморасчёты/баланс, зарплатные схемы, а также reorder-
// эндпоинт, читающий findEmployees() для ответа), поэтому фильтр по
// умолчанию закрывает бо́льшую часть критерия готовности PRD одним местом.
// includeServiceAccounts: true — явное исключение для эндпоинтов, которые
// ДОЛЖНЫ продолжать видеть служебных сотрудников без изменений (PRD, "Не в
// скоупе": "Скрытие служебных сотрудников за пределами зарплатного раздела")
// — график работы (modules/work-schedule); связи сотрудников
// (modules/employee-identity) этот порт вообще не использует, поэтому их
// не касается ни фильтр, ни опция.
export interface FindEmployeesOptions {
    includeServiceAccounts?: boolean;
}

export interface DirectoryRepositoryPort {
    findDepartments(): Promise<DepartmentSummary[]>;
    // departmentId не передан (undefined) — сотрудники всех отделов.
    findEmployees(
        departmentId?: number,
        options?: FindEmployeesOptions,
    ): Promise<EmployeeSummary[]>;
    // Батч-обновление локального порядка сотрудников (docs/employee-ordering-and-salary-filter,
    // Фаза 1) — см. ReorderEmployeesHandler.
    updateEmployeesOrder(
        items: { employeeId: number; order: number }[],
    ): Promise<void>;
    // Id всех сотрудников с isServiceAccount: true (Фаза 3) — узкий метод
    // для мест, которым не нужен весь EmployeeSummary, только множество для
    // отсева: ResolveEmployeeSalaryRulesService.forAllTargets (закрытие
    // периода не должно фиксировать снапшот/начисление по личной схеме
    // служебного аккаунта) и ListMotivationSchemasService (список зарплатных
    // схем не должен показывать схему, заведённую на служебный аккаунт, даже
    // с заглушкой имени — в отличие от действительно удалённого из Bitrix24
    // сотрудника, см. resolveTargetName).
    findServiceAccountEmployeeIds(): Promise<Set<number>>;
    // Включение/выключение признака «служебный аккаунт» (Фаза 3) — null,
    // если сотрудника с таким id нет (SetEmployeeServiceAccountHandler
    // транслирует это в EmployeeNotFoundException). Возвращает актуальный
    // EmployeeSummary с уже выставленным isServiceAccount — без отдельного
    // повторного чтения, тем же приёмом, что и updateEmployeesOrder +
    // findEmployees() в ReorderEmployeesHandler.
    setServiceAccount(
        employeeId: number,
        isServiceAccount: boolean,
    ): Promise<EmployeeSummary | null>;
}

export const DIRECTORY_REPOSITORY = Symbol('DIRECTORY_REPOSITORY');

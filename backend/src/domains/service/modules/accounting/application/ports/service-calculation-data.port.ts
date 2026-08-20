import type { EmployeeIdentityRef } from '@/shared/domain/calculation-context';
import type {
    ConfirmedTaskCompletionErpItem,
    OrderPayedErpItem,
    ServiceCompletedErpItem,
} from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';

// Источник данных для сборки CalculationContext направления service (Фаза
// 7, см. docs/payroll/plan-payroll-calculation.md). Единый порт, а не по
// одному на каждый источник: контекст собирается один раз на расчёт (см.
// BuildServiceCalculationContextService), поэтому естественно, что и вход
// для его сборки — один связный порт, а не три независимых DI-токена.
//
// Это порт чтения "через границы агрегатов" (EmployeeIdentity,
// RoappServiceOrder/RoappOrder/RoappService, WorkScheduleEntry) — не
// репозиторий одного аггрегата, а вход контекста расчёта, как и
// ServiceSalesFactSourcePort в модуле sales.
export interface ServiceCalculationDataPort {
    // Идентификация сотрудника во внешних системах (Фаза 2) — вход для
    // ролевого сопоставления правил (см. service-role-source.ts).
    findEmployeeIdentities(
        bitrixEmployeeId: number,
    ): Promise<EmployeeIdentityRef[]>;

    // Позиции оказанных услуг за период (по RoappOrder.closedAt — "выполнена"
    // означает "заказ закрыт в периоде", тот же признак, что и у
    // "оплаченного и закрытого" заказа в RoappSalesFactSourceRepository) —
    // источник для ServiceCompletedEntity. Период-широкий набор, не
    // фильтрованный по сотруднику: одно и то же erpData используется всеми
    // правилами схемы, каждое фильтрует свою выборку по своей роли само.
    findServiceCompletedItems(
        from: Date,
        to: Date,
    ): Promise<ServiceCompletedErpItem[]>;

    // Отработанные часы сотрудника за период — сумма часов рабочих смен
    // графика (WorkScheduleEntry.status = WORKING, Фаза 5,
    // docs/employee-work-schedule) вместо прежнего ручного ввода
    // EmployeeHoursEntry (модель удалена). 0, если рабочих смен нет.
    findHoursWorked(bitrixEmployeeId: number, period: string): Promise<number>;

    // Заказы, оплаченные в периоде (Фаза 8, "оплаченный" — по группе
    // статуса, см. domain/services/paid-order-status.ts) — источник для
    // OrderPayedEntity. Период-широкий набор, без фильтра по сотруднику —
    // тот же принцип, что и у findServiceCompletedItems.
    findOrderPayedItems(from: Date, to: Date): Promise<OrderPayedErpItem[]>;

    // Подтверждённые записи о выполнении задач за период (Фаза 8) —
    // источник для TaskCompletedEntity. Период-широкий набор.
    findConfirmedTaskCompletions(
        period: string,
    ): Promise<ConfirmedTaskCompletionErpItem[]>;

    // Отдел Bitrix-сотрудника — вход для поиска SalesPerformance
    // подразделения (Фаза 8, вход FloatPercent). null, если сотрудник не
    // сопоставлен ни с каким Bitrix-отделом (не должно происходить для
    // реального BitrixEmployee.departmentId, но поле не nullable в схеме,
    // а сотрудник может не существовать вовсе).
    findEmployeeDepartmentId(bitrixEmployeeId: number): Promise<number | null>;

    // Все сотрудники отдела (Фаза 9, вход отчёта GET
    // /accounting/salary_report/department/:id/:period) — один запрос на
    // весь отдел, а не по одному на сотрудника (см.
    // GetDepartmentSalaryReportService). name — "Имя Фамилия" (см.
    // src/shared/exportRoappOrders.ts, тот же формат для BitrixEmployee).
    findEmployeesInDepartment(
        departmentId: number,
    ): Promise<{ id: number; name: string }[]>;

    // Батч-версия findEmployeeIdentities для отдела целиком — один запрос
    // вместо одного на сотрудника (Фаза 9, "не должно быть N+1 запросов при
    // расчёте отдела"). Сотрудники без единой связи получают пустой массив.
    findEmployeeIdentitiesForEmployees(
        bitrixEmployeeIds: number[],
    ): Promise<Map<number, EmployeeIdentityRef[]>>;

    // Батч-версия findHoursWorked для отдела целиком (Фаза 9) — один запрос
    // вместо одного на сотрудника. Сотрудники без рабочих смен за период
    // получают 0 (как и в findHoursWorked).
    findHoursWorkedForEmployees(
        bitrixEmployeeIds: number[],
        period: string,
    ): Promise<Map<number, number>>;
}

export const SERVICE_CALCULATION_DATA = Symbol('SERVICE_CALCULATION_DATA');

import { EmployeeHoursEntry } from '@/domains/service/modules/accounting/domain/entities/employee-hours-entry.entity';

export interface EmployeeHoursEntryRepositoryPort {
    insert(entity: EmployeeHoursEntry): Promise<void>;
    update(entity: EmployeeHoursEntry): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<EmployeeHoursEntry | null>;

    // Естественный ключ записи — вход для проверки уникальности при
    // создании (@@unique в salary.prisma — последняя линия защиты) и для
    // BuildServiceCalculationContextService (Фаза 7, источник часов для
    // PayPerHour.calculate()).
    findByEmployeeAndPeriod(
        employeeId: number,
        period: string,
    ): Promise<EmployeeHoursEntry | null>;

    // Все записи периода — вход для страницы руководителя/администратора
    // (список часов всех сотрудников за месяц).
    findByPeriod(period: string): Promise<EmployeeHoursEntry[]>;
}

export const EMPLOYEE_HOURS_ENTRY_REPOSITORY = Symbol(
    'EMPLOYEE_HOURS_ENTRY_REPOSITORY',
);

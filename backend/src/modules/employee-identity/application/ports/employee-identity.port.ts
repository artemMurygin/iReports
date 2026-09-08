import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';
import {
    ExternalSystem,
    EmployeeIdentityType,
} from '../../domain/types/employee-identity.types';

// Сотрудник Bitrix, каким его знает справочник bitrix_employees — минимум,
// нужный для списка "сотрудники без связей" (см. list-unmatched-employees.service.ts).
// Отдельного BitrixEmployee-агрегата в проекте нет (справочник читается
// напрямую), поэтому порт называет форму явно, а не одалживает чужой тип.
export interface BitrixEmployeeSummary {
    id: number;
    firstName: string;
    lastName: string;
    departmentId: number;
}

export interface EmployeeIdentityRepositoryPort {
    insert(entity: EmployeeIdentity): Promise<void>;
    update(entity: EmployeeIdentity): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<EmployeeIdentity | null>;
    findByEmployee(bitrixEmployeeId: number): Promise<EmployeeIdentity[]>;

    // Все связи разом — вход для экрана «сотрудники × их связи»: он строит
    // таблицу по всему справочнику сразу, и вызов findByEmployee на каждого
    // сотрудника дал бы N+1.
    findAll(): Promise<EmployeeIdentity[]>;

    // Резолв сотрудника по значению, найденному в данных ERP (RemOnline
    // строковый онлайн-менеджер, ID сотрудника RemOnline/МойСклад) — вход
    // для контекста расчёта (см. PRD, раздел "Контекст расчёта").
    findByExternalId(
        system: ExternalSystem,
        identifierType: EmployeeIdentityType,
        externalId: string,
    ): Promise<EmployeeIdentity | null>;

    // Сотрудники Bitrix, у которых нет ни одной записи EmployeeIdentity ни
    // в одной системе — см. пользовательский сценарий "список сотрудников
    // без сопоставления" в PRD.
    findUnmatchedEmployees(): Promise<BitrixEmployeeSummary[]>;
}

export const EMPLOYEE_IDENTITY_REPOSITORY = Symbol(
    'EMPLOYEE_IDENTITY_REPOSITORY',
);

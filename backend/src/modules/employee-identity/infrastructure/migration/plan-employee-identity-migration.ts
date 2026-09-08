import {
    EmployeeIdentityType,
    ExternalSystem,
} from '../../domain/types/employee-identity.types';

// Устаревшие поля BitrixEmployee (см. bitrix.prisma) — единственный источник
// входа для миграции. Форма описана здесь, а не как срез Prisma-модели,
// чтобы функцию планирования можно было тестировать без БД.
export interface LegacyBitrixEmployeeIdentityFields {
    id: number;
    roappId: number | null;
    moySkladId: string | null;
    roappOnlineName: string | null;
}

export interface EmployeeIdentityMigrationItem {
    bitrixEmployeeId: number;
    system: ExternalSystem;
    identifierType: EmployeeIdentityType;
    externalId: string;
}

export interface ExistingEmployeeIdentityKey {
    system: ExternalSystem;
    identifierType: EmployeeIdentityType;
    externalId: string;
}

function keyOf(item: ExistingEmployeeIdentityKey): string {
    return `${item.system}:${item.identifierType}:${item.externalId}`;
}

// Идемпотентная чистая функция: переносит непустые значения
// roappId/moySkladId/roappOnlineName в записи EmployeeIdentity (Фаза 2, см.
// docs/payroll/plan-payroll-calculation.md, "Задачи" Фазы 2). Не делает
// запросов к БД сама — это позволяет тестировать её на подготовленном
// списке сотрудников, без поднятия инфраструктуры (см.
// plan-employee-identity-migration.spec.ts).
//
// `existing` — уже перенесённые связи (для повторного безопасного запуска):
// запись с тем же (system, identifierType, externalId) не дублируется.
export function planEmployeeIdentityMigration(
    employees: readonly LegacyBitrixEmployeeIdentityFields[],
    existing: Iterable<ExistingEmployeeIdentityKey> = [],
): EmployeeIdentityMigrationItem[] {
    const seen = new Set<string>();
    for (const item of existing) {
        seen.add(keyOf(item));
    }

    const plan: EmployeeIdentityMigrationItem[] = [];

    const addIfNew = (item: EmployeeIdentityMigrationItem) => {
        const key = keyOf(item);
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        plan.push(item);
    };

    for (const employee of employees) {
        if (employee.roappId != null) {
            addIfNew({
                bitrixEmployeeId: employee.id,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: String(employee.roappId),
            });
        }
        if (employee.moySkladId) {
            addIfNew({
                bitrixEmployeeId: employee.id,
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: employee.moySkladId,
            });
        }
        if (employee.roappOnlineName) {
            addIfNew({
                bitrixEmployeeId: employee.id,
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: employee.roappOnlineName,
            });
        }
    }

    return plan;
}

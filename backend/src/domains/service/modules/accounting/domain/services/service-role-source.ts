import type { CalculationEmployee } from '@/shared/domain/calculation-context';
import type { TargetRole } from '../types/salary-rule.types';

// Маппинг «роль правила → поле ERP» для сервиса (RoApp/RemOnline) — Фаза 7
// (см. docs/payroll/plan-payroll-calculation.md и
// prd-payroll-calculation.md, раздел "Технические ограничения"). Живёт в
// домене, а не настраивается пользователем: соответствие зависит от
// структуры данных RoApp, а не от бизнес-решений руководителя.
//
// - ENGINEER — уровень позиции заказа, а не заказа целиком:
//   RoappServiceOrder.engineerId (услуги) / RoappProductsOrder.engineerId
//   (товары). ServiceCompletedEntity использует только первое (правило
//   платит за услуги), второе зарезервировано для будущих правил, платящих
//   за проданные в заказе товары.
// - ONLINE_MANAGER — строковое кастомное поле RoappOrder.onlineManager;
//   сопоставление идёт через EmployeeIdentity типа ONLINE_MANAGER_FIELD, а
//   не по числовому ID.
// - Остальные роли — обычные ссылки на RoappEmployee на уровне заказа.
//   RoappOrder несёт только три таких поля (managerId, createdById,
//   closedById) на четыре роли (OFFLINE_MANAGER, ORDER_MANAGER, CREATED_BY,
//   CLOSED_BY): CREATED_BY и CLOSED_BY однозначно резолвятся по названию
//   поля, а офлайн-менеджер и менеджер заказа отдельного поля не имеют —
//   решение (ответ на открытый вопрос плана "полный перечень targetRole для
//   сервиса", Фаза 7) — оба резолвятся через managerId. Один и тот же заказ
//   может засчитаться под любой из этих двух ролей — это не два
//   независимых источника данных, а два разных прочтения одного поля,
//   выбираемых конкретным правилом через его targetRole.
export interface ServiceOrderRoleFields {
    engineerId: number;
    managerId: number | null;
    createdById: number;
    closedById: number | null;
    onlineManager: string | null;
}

type ServiceRoleSource =
    | { kind: 'ENGINEER_ID' }
    | { kind: 'ONLINE_MANAGER_FIELD' }
    | {
          kind: 'ORDER_EMPLOYEE_FIELD';
          field: 'managerId' | 'createdById' | 'closedById';
      };

export function resolveServiceRoleSource(role: TargetRole): ServiceRoleSource {
    switch (role) {
        case 'ENGINEER':
            return { kind: 'ENGINEER_ID' };
        case 'ONLINE_MANAGER':
            return { kind: 'ONLINE_MANAGER_FIELD' };
        case 'OFFLINE_MANAGER':
        case 'ORDER_MANAGER':
            return { kind: 'ORDER_EMPLOYEE_FIELD', field: 'managerId' };
        case 'CREATED_BY':
            return { kind: 'ORDER_EMPLOYEE_FIELD', field: 'createdById' };
        case 'CLOSED_BY':
            return { kind: 'ORDER_EMPLOYEE_FIELD', field: 'closedById' };
    }
}

// Проверяет, встречается ли сотрудник (по его EmployeeIdentity) в данных
// ERP-записи в качестве роли `role`. Правило само вызывает эту функцию по
// своему targetRole — расчёт периода не содержит ветвлений по ролям (см.
// PeriodCalculationOrchestrator).
export function employeeMatchesServiceRole(
    employee: CalculationEmployee,
    role: TargetRole,
    fields: ServiceOrderRoleFields,
): boolean {
    const source = resolveServiceRoleSource(role);

    if (source.kind === 'ENGINEER_ID') {
        return hasRoappEmployeeIdentity(employee, fields.engineerId);
    }
    if (source.kind === 'ONLINE_MANAGER_FIELD') {
        return (
            fields.onlineManager !== null &&
            hasIdentity(employee, 'ONLINE_MANAGER_FIELD', fields.onlineManager)
        );
    }
    const value = fields[source.field];
    return value !== null && hasRoappEmployeeIdentity(employee, value);
}

function hasRoappEmployeeIdentity(
    employee: CalculationEmployee,
    roappEmployeeId: number,
): boolean {
    return hasIdentity(employee, 'EMPLOYEE_ID', String(roappEmployeeId));
}

function hasIdentity(
    employee: CalculationEmployee,
    identifierType: 'EMPLOYEE_ID' | 'ONLINE_MANAGER_FIELD',
    externalId: string,
): boolean {
    return employee.identities.some(
        (identity) =>
            identity.system === 'ROAPP' &&
            identity.identifierType === identifierType &&
            identity.externalId === externalId,
    );
}

import type { CalculationEmployee } from '@/shared/domain/calculation-context';
import type { TargetRole } from '../types/salary-rule.types';
import { ArgumentInvalidException } from '@/shared/exceptions';

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
//   Ни офлайн-менеджер, ни менеджер заказа отдельного поля в RoappOrder не
//   имеют — решение (ответ на открытый вопрос плана "полный перечень
//   targetRole для сервиса", Фаза 7) — оба резолвятся через managerId. Один
//   и тот же заказ может засчитаться под любой из этих двух ролей — это не
//   два независимых источника данных, а два разных прочтения одного поля,
//   выбираемых конкретным правилом через его targetRole.
export interface ServiceOrderRoleFields {
    engineerId: number;
    managerId: number | null;
    onlineManager: string | null;
}

type ServiceRoleSource =
    | { kind: 'ENGINEER_ID' }
    | { kind: 'ONLINE_MANAGER_FIELD' }
    | { kind: 'ORDER_EMPLOYEE_FIELD'; field: 'managerId' };

export function resolveServiceRoleSource(role: TargetRole): ServiceRoleSource {
    switch (role) {
        case 'ENGINEER':
            return { kind: 'ENGINEER_ID' };
        case 'ONLINE_MANAGER':
            return { kind: 'ONLINE_MANAGER_FIELD' };
        case 'OFFLINE_MANAGER':
        case 'ORDER_MANAGER':
            return { kind: 'ORDER_EMPLOYEE_FIELD', field: 'managerId' };
        default:
            // ONLINE_PURCHASER/OFFLINE_PURCHASER — роли магазина, добавленные
            // в общий targetRoleSchema Фазой 12 (см.
            // contracts/commands/salary-rule.ts) для переиспользования
            // одного enum'а обоими направлениями. Правило сервиса их
            // получить не должно — это ошибка конфигурации правила, а не
            // данных (то же решение, что у shop-role-source.ts).
            throw new ArgumentInvalidException(
                `Роль "${role}" не относится к направлению service`,
            );
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

// Экспортируется отдельно от employeeMatchesServiceRole (Фаза 8) — нужна
// OrderPayedEntity для роли ENGINEER, которая на уровне заказа определена не
// одним полем (в отличие от остальных трёх ролей), а множеством инженеров
// его позиций (см. order-payed.entity.ts) — employeeMatchesServiceRole
// рассчитан на ровно одно значение engineerId и не годится напрямую.
export function hasRoappEmployeeIdentity(
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

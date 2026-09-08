import type { CalculationEmployee } from '@/shared/domain/calculation-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import type { TargetRole } from '../types/salary-rule.types';

// Маппинг «роль правила → поле ERP МойСклад» для магазина — Фаза 12 (issue
// #58, см. docs/payroll/plan-payroll-calculation.md и
// prd-payroll-calculation.md, раздел "Роли магазина"). Зеркало
// domains/service/modules/accounting/domain/services/service-role-source.ts,
// независимая реализация (issue #57 — без переиспользования кода
// сервиса), хотя итоговая таблица ролей магазина проще:
//
// - ONLINE_MANAGER / OFFLINE_MANAGER — лежат на уровне ОТГРУЗКИ
//   (MoySkladDemand.onlineManagerId/offlineManagerId) — продавец один на
//   весь чек.
// - ONLINE_PURCHASER / OFFLINE_PURCHASER — лежат на уровне ТОВАРНОЙ
//   ПОЗИЦИИ (MoySkladDemandPosition.onlinePurchaserId/offlinePurchaserId,
//   Фаза 10) — закупщик БУ техники свой у каждого устройства, в одном чеке
//   могут быть два БУ-айфона, выкупленные разными людьми. Используется
//   UsedProductSold (Фаза 13) — ProductSold (Фаза 12) работает исключительно
//   с ролями отгрузки.
//
// spec: shop/accounting#requirement-виды-зарплатных-правил
export interface ShopDemandRoleFields {
    onlineManagerId: string | null;
    offlineManagerId: string | null;
}

export interface ShopPositionPurchaserRoleFields {
    onlinePurchaserId: string | null;
    offlinePurchaserId: string | null;
}

type ShopRoleSource =
    | {
          kind: 'DEMAND_MANAGER_FIELD';
          field: 'onlineManagerId' | 'offlineManagerId';
      }
    | {
          kind: 'POSITION_PURCHASER_FIELD';
          field: 'onlinePurchaserId' | 'offlinePurchaserId';
          identifierType:
              | 'MOY_SKLAD_ONLINE_PURCHASER_FIELD'
              | 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD';
      };

export function resolveShopRoleSource(role: TargetRole): ShopRoleSource {
    switch (role) {
        case 'ONLINE_MANAGER':
            return { kind: 'DEMAND_MANAGER_FIELD', field: 'onlineManagerId' };
        case 'OFFLINE_MANAGER':
            return { kind: 'DEMAND_MANAGER_FIELD', field: 'offlineManagerId' };
        case 'ONLINE_PURCHASER':
            return {
                kind: 'POSITION_PURCHASER_FIELD',
                field: 'onlinePurchaserId',
                identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
            };
        case 'OFFLINE_PURCHASER':
            return {
                kind: 'POSITION_PURCHASER_FIELD',
                field: 'offlinePurchaserId',
                identifierType: 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
            };
        default:
            // ENGINEER/ORDER_MANAGER — роли сервиса,
            // targetRoleSchema теперь общий enum обоих направлений (см.
            // contracts/commands/salary-rule.ts), но правило магазина их
            // никогда не должно получать — это ошибка конфигурации
            // правила, а не данных, поэтому доменное исключение, а не
            // молчаливый false.
            throw new ArgumentInvalidException(
                `Роль "${role}" не относится к направлению shop`,
            );
    }
}

// Совпадает ли сотрудник с ролью, определяемой на уровне ОТГРУЗКИ
// (ONLINE_MANAGER/OFFLINE_MANAGER). Используется ProductSold (Фаза 12).
export function employeeMatchesShopDemandRole(
    employee: CalculationEmployee,
    role: TargetRole,
    fields: ShopDemandRoleFields,
): boolean {
    const source = resolveShopRoleSource(role);
    if (source.kind !== 'DEMAND_MANAGER_FIELD') {
        throw new ArgumentInvalidException(
            `Роль "${role}" определяется не на уровне отгрузки, а на уровне товарной позиции`,
        );
    }
    const value = fields[source.field];
    return value !== null && hasMoySkladEmployeeIdentity(employee, value);
}

// Совпадает ли сотрудник с ролью закупщика, определяемой на уровне ТОВАРНОЙ
// ПОЗИЦИИ (ONLINE_PURCHASER/OFFLINE_PURCHASER). Используется будущим
// UsedProductSold (Фаза 13) — уже реализовано здесь, чтобы каталог ролей
// был полным с Фазы 12 (см. заголовок файла).
export function employeeMatchesShopPurchaserRole(
    employee: CalculationEmployee,
    role: TargetRole,
    fields: ShopPositionPurchaserRoleFields,
): boolean {
    const source = resolveShopRoleSource(role);
    if (source.kind !== 'POSITION_PURCHASER_FIELD') {
        throw new ArgumentInvalidException(
            `Роль "${role}" определяется не на уровне товарной позиции, а на уровне отгрузки`,
        );
    }
    const value = fields[source.field];
    return (
        value !== null && hasIdentity(employee, source.identifierType, value)
    );
}

export function hasMoySkladEmployeeIdentity(
    employee: CalculationEmployee,
    moySkladEmployeeId: string,
): boolean {
    return hasIdentity(employee, 'EMPLOYEE_ID', moySkladEmployeeId);
}

function hasIdentity(
    employee: CalculationEmployee,
    identifierType:
        | 'EMPLOYEE_ID'
        | 'MOY_SKLAD_ONLINE_PURCHASER_FIELD'
        | 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
    externalId: string,
): boolean {
    return employee.identities.some(
        (identity) =>
            identity.system === 'MOY_SKLAD' &&
            identity.identifierType === identifierType &&
            identity.externalId === externalId,
    );
}

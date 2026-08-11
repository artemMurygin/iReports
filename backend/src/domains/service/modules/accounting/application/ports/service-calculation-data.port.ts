import type { EmployeeIdentityRef } from '@/shared/domain/calculation-context';
import type { ServiceCompletedErpItem } from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';

// Источник данных для сборки CalculationContext направления service (Фаза
// 7, см. docs/payroll/plan-payroll-calculation.md). Единый порт, а не по
// одному на каждый источник: контекст собирается один раз на расчёт (см.
// BuildServiceCalculationContextService), поэтому естественно, что и вход
// для его сборки — один связный порт, а не три независимых DI-токена.
//
// Это порт чтения "через границы агрегатов" (EmployeeIdentity,
// RoappServiceOrder/RoappOrder/RoappService, EmployeeHoursEntry) — не
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

    // Отработанные часы сотрудника за период — ручной ввод (Фаза 7,
    // EmployeeHoursEntry). 0, если записи нет.
    findHoursWorked(bitrixEmployeeId: number, period: string): Promise<number>;
}

export const SERVICE_CALCULATION_DATA = Symbol('SERVICE_CALCULATION_DATA');

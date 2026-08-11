import type { ServiceOrderRoleFields } from '../services/service-role-source';

// Конкретное наполнение CalculationContext.erpData для направления service
// (Фаза 7, см. docs/payroll/plan-payroll-calculation.md). Собирается один
// раз приложением (BuildServiceCalculationContextService) и передаётся
// правилам неизменным — правило само фильтрует нужные ему записи по своей
// роли (см. service-role-source.ts), к репозиториям не обращается.

// Одна позиция оказанной услуги (RoappServiceOrder), обогащённая
// ролевыми полями её заказа (RoappOrder) и ставкой справочника услуги
// (RoappService) — источник для ServiceCompletedEntity.
export interface ServiceCompletedErpItem extends ServiceOrderRoleFields {
    // Источник строки расчёта (CalculationSourceRef.id).
    serviceOrderId: number;
    orderId: number;
    serviceId: number;
    quantity: number;
    // RoappServiceOrder.price — фактическая цена услуги по этому заказу
    // (целые рубли), а не каталожная RoappService.price: расчёт опирается
    // на исходные суммы заказа, а не на предрассчитанный legacy-KPI (см.
    // prd-payroll-calculation.md, "Технические ограничения").
    linePrice: number;
    // RoappService.engeneerBonus — ставка "за услугу" из справочника услуг,
    // источник для award.type === 'ServiceFixed'.
    catalogEngineerBonus: number;
}

export interface ServiceCalculationErpData {
    serviceCompletedItems: ServiceCompletedErpItem[];
    // Часы сотрудника за период — ручной ввод (EmployeeHoursEntry), не
    // ERP-данные в строгом смысле, но тот же принцип "правило не ходит в
    // БД само" требует, чтобы значение пришло из контекста. 0, если записи
    // нет.
    hoursWorked: number;
}

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

// Один оплаченный заказ (Фаза 8, источник для OrderPayedEntity) — уровень
// заказа целиком, а не позиции: "оплаченность" (см. paid-order-status.ts) и
// суммы REVENUE/MARGIN/SALARY_MINUS_ENGINEER_SALARY определены только на
// заказе. Ролевые поля заказа (managerId/onlineManager) — те же, что и у
// ServiceOrderRoleFields, но engineerId
// сюда намеренно не входит одним числом: у заказа может быть несколько
// инженеров (по разным позициям), поэтому роль ENGINEER для OrderPayed
// матчится отдельно, по множеству engineerIds (см.
// order-payed.entity.ts).
export interface OrderPayedErpItem {
    orderId: number;
    managerId: number | null;
    onlineManager: string | null;
    // Инженеры позиций заказа (услуг и товаров), без дублей — источник для
    // роли ENGINEER (см. order-payed.entity.ts, комментарий у matchesOrder).
    engineerIds: number[];
    // Исходные суммы заказа (RoappOrder.payed/cost/engineerSalary) — НЕ
    // RoappOrder.managerSalary (legacy-KPI с зашитыми 10%, см.
    // prd-payroll-calculation.md, "Технические ограничения"). null-суммы
    // трактуются как 0 — заказ, прошедший фильтр "оплаченного" статуса, но
    // без числового payed, не должен ронять расчёт.
    revenue: number;
    cost: number;
    engineerSalary: number;
}

// Одна подтверждённая руководителем запись о выполнении задачи (Фаза 8,
// источник для TaskCompletedEntity) — см. domain/entities/task-completion.entity.ts.
// Набор period-wide (все сотрудники периода, без фильтра) — как и у
// serviceCompletedItems, каждое правило фильтрует свою выборку само.
export interface ConfirmedTaskCompletionErpItem {
    id: string;
    employeeId: number;
}

export interface ServiceCalculationErpData {
    serviceCompletedItems: ServiceCompletedErpItem[];
    // Часы сотрудника за период — сумма часов рабочих смен графика
    // (WorkScheduleEntry.status = WORKING, Фаза 5,
    // docs/employee-work-schedule), не ERP-данные в строгом смысле, но тот
    // же принцип "правило не ходит в БД само" требует, чтобы значение
    // пришло из контекста. 0, если рабочих смен нет.
    hoursWorked: number;
    // Фаза 8 — заказы, оплаченные в периоде (источник OrderPayedEntity), и
    // подтверждённые выполнения задач (источник TaskCompletedEntity).
    // Опциональны (в отличие от serviceCompletedItems/hoursWorked Фазы 7) —
    // так существующие фикстуры контекста PayPerHour/ServiceCompleted
    // (Фаза 7) остаются валидными без правки; OrderPayedEntity/
    // TaskCompletedEntity сами подставляют [] при отсутствии поля (тот же
    // приём, что и erpData?.hoursWorked ?? 0).
    orderPayedItems?: OrderPayedErpItem[];
    confirmedTaskCompletions?: ConfirmedTaskCompletionErpItem[];
}

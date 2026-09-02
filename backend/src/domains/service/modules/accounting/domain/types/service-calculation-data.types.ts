import type { ServiceOrderRoleFields } from '../services/service-role-source';
import type { TaskRuleStatus } from 'ireports-contracts';

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
    // RoappOrder.label — человекочитаемый номер заказа ("А123456"),
    // источник CalculationSourceRef.label/link (см. service-completed.entity.ts).
    orderLabel: string;
    // RoappOrder.deviceBrand/deviceModel/deviceColor/malfunction — источник
    // CalculationSourceRef.brand/deviceModel/deviceColor/malfunction (см.
    // service-completed.entity.ts). null, если ERP не отдал соответствующее
    // поле по заказу.
    brand: string | null;
    deviceModel: string | null;
    deviceColor: string | null;
    malfunction: string | null;
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
    // RoappService.name — источник CalculationSourceRef.itemName (см.
    // service-completed.entity.ts).
    serviceName: string;
    // RoappOrder.orderTypeId — "категория заказа" в терминах Фазы 3
    // (docs/service-plan-salary-rule-order-category-filter), источник для
    // фильтра ServiceCompletedSalaryConfig.orderTypeIds (см.
    // service-completed.entity.ts). НЕ SalesPlan.category.
    orderTypeId: number;
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
    // RoappOrder.label — человекочитаемый номер заказа ("А123456"),
    // источник CalculationSourceRef.label/link (см. order-payed.entity.ts).
    label: string;
    // RoappOrder.deviceBrand/deviceModel/deviceColor/malfunction — источник
    // CalculationSourceRef.brand/deviceModel/deviceColor/malfunction (см.
    // order-payed.entity.ts). null, если ERP не отдал соответствующее поле
    // по заказу.
    brand: string | null;
    deviceModel: string | null;
    deviceColor: string | null;
    malfunction: string | null;
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
    // RoappOrder.orderTypeId — "категория заказа" в терминах Фазы 3
    // (docs/service-plan-salary-rule-order-category-filter), источник для
    // фильтра OrderPayedSalaryConfig.orderTypeIds (см.
    // order-payed.entity.ts). НЕ SalesPlan.category.
    orderTypeId: number;
}

// Одна подтверждённая руководителем запись о выполнении задачи — временный
// воркфлоу TaskCompletion (см. domain/entities/task-completion.entity.ts),
// выведенный из эксплуатации change'ем salary-rule-bitrix-task (spec.md,
// "Вывод из эксплуатации воркфлоу TaskCompletion"): TaskCompletedEntity
// больше не читает это поле в calculate() — источник факта/прогноза теперь
// bitrixTaskStatuses ниже. Тип и заполняющий его код (см.
// build-service-calculation-context.service.ts) остаются до
// завершения cutover (задачи 5.3/11.2 change salary-rule-bitrix-task), не
// удалены этим срезом задач.
export interface ConfirmedTaskCompletionErpItem {
    id: string;
    employeeId: number;
}

// Статус и расчётный месяц одной задачи Bitrix24, привязанной к правилу
// TaskCompleted (source для TaskCompletedEntity.calculate(), design.md
// change salary-rule-bitrix-task, Decision 1) — уже нормализованный к трём
// бизнес-статусам (Decision 6), а не сырой код Bitrix24 Tasks: маппинг
// сырого статуса ('1'..'7', BitrixTasksService/bitrix-api.types.ts) в
// TaskRuleStatus делает application-слой при сборке контекста
// (BuildServiceCalculationContextService), а не домен — домен не зависит от
// src/integrations/bitrix (см. backend/CLAUDE.md, "domain never imports
// from infrastructure").
//
// isAvailable — false для удалённой/недоступной задачи (нет прав, не
// найдена); тогда status/period не несут значения (Decision 6/7 и Risks).
// period — расчётный месяц, распарсенный из тега периода задачи; null, если
// тег отсутствует или не в формате YYYY-MM (spec.md, "Обработка недоступной
// задачи" — нераспознанный тег трактуется как недоступность).
export interface BitrixTaskRuleStatusItem {
    id: number;
    isAvailable: boolean;
    status: TaskRuleStatus | null;
    period: string | null;
}

// Пара факт/прогноз часов PayPerHour — считаются один раз (см.
// ServiceCalculationDataRepository.findHoursWorked) и передаются в ОБА
// прохода calculate() (FACT и PROGNOSE читают один и тот же erpData,
// различается только context.mode, см. get-employee-salary-report.service.ts) —
// правило само выбирает нужное поле по режиму, а не пересчитывает дату.
// fact — сумма часов графика по сегодняшний день включительно, prognose —
// сумма часов графика за весь период (включая ещё не наступившие дни).
export interface PayPerHourHours {
    fact: number;
    prognose: number;
}

export interface ServiceCalculationErpData {
    serviceCompletedItems: ServiceCompletedErpItem[];
    // Часы сотрудника за период — сумма часов рабочих смен графика
    // (WorkScheduleEntry.status = WORKING, роль дня — см.
    // PayPerHoursEntity.ELIGIBLE_SCHEDULE_ROLES) — не ERP-данные в строгом
    // смысле, но тот же принцип "правило не ходит в БД само" требует, чтобы
    // значение пришло из контекста. 0 по обоим полям, если подходящих
    // рабочих смен нет.
    hoursWorked: PayPerHourHours;
    // Фаза 8 — заказы, оплаченные в периоде (источник OrderPayedEntity), и
    // подтверждённые выполнения задач (источник TaskCompletedEntity).
    // Опциональны (в отличие от serviceCompletedItems/hoursWorked Фазы 7) —
    // так существующие фикстуры контекста PayPerHour/ServiceCompleted
    // (Фаза 7) остаются валидными без правки; OrderPayedEntity/
    // TaskCompletedEntity сами подставляют [] при отсутствии поля (тот же
    // приём, что и erpData?.hoursWorked ?? 0).
    orderPayedItems?: OrderPayedErpItem[];
    confirmedTaskCompletions?: ConfirmedTaskCompletionErpItem[];
    // Пакетно полученные статусы/расчётные месяцы задач Bitrix24 всех
    // bitrixTaskIds правил TaskCompleted, попавших в расчёт (Decision 1 и
    // 3) — один batched-запрос на весь отчёт, а не по одному на правило
    // (собирается BuildServiceCalculationContextService, задача 6.1
    // change salary-rule-bitrix-task). Опционально по тому же принципу, что
    // orderPayedItems/confirmedTaskCompletions выше — существующие
    // фикстуры контекста без этого поля остаются валидными,
    // TaskCompletedEntity сама подставляет [] при отсутствии.
    bitrixTaskStatuses?: BitrixTaskRuleStatusItem[];
}

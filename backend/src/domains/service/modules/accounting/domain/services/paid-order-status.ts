// Решение по открытому вопросу PRD "что считается «оплаченным заказом» для
// OrderPayed" (Фаза 8, см. docs/payroll/plan-payroll-calculation.md):
// заказ считается оплаченным по ГРУППЕ статуса заказа
// (RoappOrderStatus.grupName), а не по факту заполненного RoappOrder.payed
// — статус отражает реальный бизнес-процесс сервиса (деньги могут прийти
// частями/предоплатой задолго до итогового статуса), тогда как `payed` —
// просто накопленная сумма, не сигнал "заказ закрыт как оплаченный".
//
// RoappOrderStatus — справочник, синхронизируемый из конкретного аккаунта
// RemOnline (см. prisma/schema/roapp.prisma), а НЕ enum в коде: `grupName`
// — произвольная строка, задаваемая в самом RemOnline и специфичная для
// аккаунта заказчика. Поэтому список "оплаченных" групп статуса — открытая
// (расширяемая) константа на уровне бэкенда, а не значение в БД/схеме — тот
// же приём, что и SERVICE_FUNNEL_CATEGORY_ID в
// domains/service/modules/sales/infrastructure/sales.repositories.ts.
//
// ВАЖНО: значения ниже — заглушка по наиболее вероятному смыслу (типичные
// названия групп статусов "заказ оплачен/выполнен" в RemOnline). Перед
// использованием в проде свериться с реальными данными таблицы
// roapp_order_statuses (столбец grup_name) у конкретного заказчика и
// поправить список. Отдельный UI/эндпоинт для управления списком — вне
// скоупа Фазы 8, плоская конфигурация здесь осознанно достаточна.
export const PAID_ORDER_STATUS_GROUPS: readonly string[] = [
    'Готово',
    'Оплачен',
    'Выполнен',
];

export function isPaidOrderStatusGroup(
    grupName: string | null | undefined,
): boolean {
    return grupName != null && PAID_ORDER_STATUS_GROUPS.includes(grupName);
}

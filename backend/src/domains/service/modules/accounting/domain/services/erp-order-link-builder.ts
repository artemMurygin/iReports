// Прямая ссылка на карточку заказа в веб-интерфейсе RemOnline (не путать с
// api.roapp.io — базовым URL REST API интеграции, см.
// integrations/roapp/roapp.instace.ts) — используется в sources[] строк
// расчёта зарплаты (order-payed.entity.ts, service-completed.entity.ts),
// чтобы сотрудник мог перейти к заказу и увидеть, за что начислена сумма.
export function buildErpOrderLink(orderId: number): string {
    return `https://web.roapp.io/orders/table/${orderId}`;
}

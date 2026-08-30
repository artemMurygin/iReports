// Прямая ссылка на карточку документа отгрузки в веб-интерфейсе МойСклад
// (не путать с api.moysklad.ru — базовым URL REST API интеграции) —
// используется в sources[] строк расчёта зарплаты (product-sold.entity.ts,
// used-product-sold.entity.ts), чтобы сотрудник мог перейти к отгрузке и
// увидеть, за что начислена сумма. Зеркало buildRoappOrderLink у сервиса
// (roapp-order-link.ts).
//
// ВНИМАНИЕ: формат URL — предположение по общей публичной схеме ссылок
// МойСклад (online.moysklad.ru/app/#<сущность>/edit?id=<uuid>), не
// подтверждён вручную в реальном интерфейсе компании — стоит проверить с
// продуктом/пользователем перед релизом.
export function buildErpDemandLink(demandId: string): string {
    return 'https://online.moysklad.ru/app/#demand/edit?id=' + demandId;
}

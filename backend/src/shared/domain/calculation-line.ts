// Результат calculate() одного зарплатного правила за один проход (один
// CalculationMode) — не число, а строка расчёта. Сценарий «сотрудник видит
// разбивку по каждому правилу с указанием, на каких заказах она получена»
// невыполним при возврате скаляра (см. PRD, раздел «Контекст расчёта»).
// Форма едина для service и shop; зеркало для HTTP-ответа —
// contracts/commands/salary-rule.ts → calculationLineSchema.

export interface CalculationSourceRef {
    // Конкретные типы источников определяет само правило своего домена
    // ('order' | 'orderItem' | 'demand' | 'demandPosition' | ...).
    type: string;
    id: string | number;
    // Человекочитаемый номер документа-источника в ERP (например,
    // RoappOrder.label "А123456") и прямая ссылка на его карточку —
    // заполняются только там, где у источника есть такой документ (сегодня —
    // заказ/позиция заказа RemOnline, см. order-payed.entity.ts и
    // service-completed.entity.ts); для источников без него (задача,
    // позиция отгрузки МойСклад) остаются undefined.
    label?: string;
    link?: string;
    // Сумма начисления, приходящаяся на этот конкретный источник в РЕЖИМЕ
    // текущей строки (CalculationLine.amount тоже посчитан для одного
    // режима — FACT либо PROGNOSE) — независимо посчитанная база×ставка
    // для этого источника, а не персональная доля от округлённой суммы
    // всего правила.
    amount?: number;
    // Наименование модели устройства и его неисправность (RoappOrder.
    // deviceBrand/deviceModel/deviceColor/malfunction) — заполняются только
    // там, где источник — заказ/позиция заказа RemOnline (см.
    // order-payed.entity.ts и service-completed.entity.ts), как и label/link
    // выше; для остальных типов источников остаются undefined.
    brand?: string;
    deviceModel?: string;
    deviceColor?: string;
    malfunction?: string;
    // Название конкретного товара/услуги — заполняется правилом, когда
    // источник умеет его определить: сегодня ServiceCompleted (service), в
    // следующей фазе — ProductSold/UsedProductSold (shop).
    itemName?: string;
}

export interface CalculationLine {
    ruleId: string;
    // База начисления (REVENUE / MARGIN / ...) — не у всех правил есть
    // (например, у PayPerHour), поэтому опционально.
    salaryBasis?: string;
    quantity?: number;
    rate?: number;
    amount: number;
    sources: CalculationSourceRef[];
}

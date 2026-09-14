import {
    isPaidOrderStatusGroup,
    PAID_ORDER_STATUS_GROUPS,
} from './paid-order-status';

describe('isPaidOrderStatusGroup', () => {
    it('распознаёт группы из настроенного списка', () => {
        for (const group of PAID_ORDER_STATUS_GROUPS) {
            expect(isPaidOrderStatusGroup(group)).toBe(true);
        }
    });

    // Регрессия на «OrderPayed всегда ноль»: список был заглушкой
    // ('Готово'/'Оплачен'/'Выполнен'), не пересекавшейся с реальными
    // grup_name аккаунта RemOnline ни на одну строку — правило молча
    // считалось в ноль вместо того, чтобы упасть. Тот же класс регрессии
    // повторился позже, когда аккаунт RemOnline сменил язык интерфейса на
    // английский ('Закрытые успешно' → 'Closed' и т.п. 1:1) — список
    // остался русским. Проверка приколачивает текущее фактическое значение
    // справочника, чтобы ни та, ни эта заглушка не вернулись незамеченными.
    it('распознаёт реальную группу справочника RemOnline', () => {
        expect(isPaidOrderStatusGroup('Closed')).toBe(true);
    });

    it('отклоняет группы незакрытых и неуспешных заказов', () => {
        expect(isPaidOrderStatusGroup('In progress')).toBe(false);
        // Ремонт сделан, но заказ не закрыт и деньги не получены.
        expect(isPaidOrderStatusGroup('Done')).toBe(false);
        expect(isPaidOrderStatusGroup('Dropped off')).toBe(false);
    });

    it('отклоняет null/undefined', () => {
        expect(isPaidOrderStatusGroup(null)).toBe(false);
        expect(isPaidOrderStatusGroup(undefined)).toBe(false);
    });
});

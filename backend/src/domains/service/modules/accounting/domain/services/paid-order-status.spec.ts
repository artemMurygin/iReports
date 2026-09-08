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
    // считалось в ноль вместо того, чтобы упасть. Проверка приколачивает
    // фактическое значение справочника, чтобы заглушка не вернулась
    // незамеченной.
    it('распознаёт реальную группу справочника RemOnline', () => {
        expect(isPaidOrderStatusGroup('Закрытые успешно')).toBe(true);
    });

    it('отклоняет группы незакрытых и неуспешных заказов', () => {
        expect(isPaidOrderStatusGroup('В работе')).toBe(false);
        // Ремонт сделан, но заказ не закрыт и деньги не получены.
        expect(isPaidOrderStatusGroup('Готовые')).toBe(false);
        expect(isPaidOrderStatusGroup('Закрытые неуспешно')).toBe(false);
    });

    it('отклоняет null/undefined', () => {
        expect(isPaidOrderStatusGroup(null)).toBe(false);
        expect(isPaidOrderStatusGroup(undefined)).toBe(false);
    });
});

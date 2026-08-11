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

    it('отклоняет группу вне списка', () => {
        expect(isPaidOrderStatusGroup('В работе')).toBe(false);
    });

    it('отклоняет null/undefined', () => {
        expect(isPaidOrderStatusGroup(null)).toBe(false);
        expect(isPaidOrderStatusGroup(undefined)).toBe(false);
    });
});

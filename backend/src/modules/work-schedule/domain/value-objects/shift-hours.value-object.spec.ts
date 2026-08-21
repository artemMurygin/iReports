import { ShiftHours } from './shift-hours.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ShiftHours', () => {
    it.each([2, 2.5, 8, 15.5, 16])(
        'принимает граничные и промежуточные значения диапазона: %s',
        (value) => {
            expect(ShiftHours.create(value).getValue()).toBe(value);
        },
    );

    it('отклоняет часы меньше 2', () => {
        withRequestContext(() => {
            expect(() => ShiftHours.create(1.5)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('отклоняет часы больше 16', () => {
        withRequestContext(() => {
            expect(() => ShiftHours.create(16.5)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('отклоняет часы, не кратные 0,5', () => {
        withRequestContext(() => {
            expect(() => ShiftHours.create(8.3)).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});

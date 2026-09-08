import { ScheduleDate } from './schedule-date.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ScheduleDate', () => {
    it('создаёт дату из строки YYYY-MM-DD', () => {
        const date = ScheduleDate.create('2026-08-05');

        expect(date.getValue()).toBe('2026-08-05');
    });

    it('fromDate/toDate — обратимый переход через UTC-полночь', () => {
        const date = ScheduleDate.create('2026-08-05');

        const roundTripped = ScheduleDate.fromDate(date.toDate());

        expect(roundTripped.getValue()).toBe('2026-08-05');
    });

    it('отклоняет строку не в формате YYYY-MM-DD', () => {
        withRequestContext(() => {
            expect(() => ScheduleDate.create('05.08.2026')).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('отклоняет несуществующий календарный день (31 апреля)', () => {
        withRequestContext(() => {
            expect(() => ScheduleDate.create('2026-04-31')).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('отклоняет несуществующий день високосного года (29 февраля не 2026)', () => {
        withRequestContext(() => {
            expect(() => ScheduleDate.create('2026-02-29')).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});

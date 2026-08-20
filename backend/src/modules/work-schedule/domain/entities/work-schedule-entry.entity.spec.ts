import { WorkScheduleEntry } from './work-schedule-entry.entity';
import { ScheduleDate } from '../value-objects/schedule-date.value-object';
import { WorkDay } from '../value-objects/work-day.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('WorkScheduleEntry', () => {
    const buildDay = () => WorkDay.create({ status: 'WORKING', hours: 8 });

    describe('create', () => {
        it('создаёт запись с генерируемым id', () => {
            const entry = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: buildDay(),
            });

            expect(entry.id).toEqual(expect.any(String));
            expect(entry.employeeId).toBe(42);
            expect(entry.date.getValue()).toBe('2026-08-05');
            expect(entry.day.status).toBe('WORKING');
            expect(entry.day.hours).toBe(8);
        });

        it('отклоняет некорректный id сотрудника', () => {
            withRequestContext(() => {
                expect(() =>
                    WorkScheduleEntry.create({
                        employeeId: 0,
                        date: ScheduleDate.create('2026-08-05'),
                        day: buildDay(),
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    describe('edit', () => {
        it('заменяет состояние дня целиком, employeeId/date не меняются', () => {
            const entry = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: buildDay(),
            });

            entry.edit(WorkDay.create({ status: 'DAY_OFF' }));

            expect(entry.day.status).toBe('DAY_OFF');
            expect(entry.day.hours).toBeNull();
            expect(entry.employeeId).toBe(42);
            expect(entry.date.getValue()).toBe('2026-08-05');
        });
    });
});

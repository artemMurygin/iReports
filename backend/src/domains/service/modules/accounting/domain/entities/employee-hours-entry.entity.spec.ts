import { EmployeeHoursEntry } from './employee-hours-entry.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('EmployeeHoursEntry', () => {
    describe('create', () => {
        it('создаёт запись с генерируемым id', () => {
            const entry = EmployeeHoursEntry.create({
                employeeId: 42,
                period: '2026-08',
                hours: 160,
            });

            expect(entry.id).toEqual(expect.any(String));
            expect(entry.employeeId).toBe(42);
            expect(entry.period).toBe('2026-08');
            expect(entry.hours).toBe(160);
        });

        it('отклоняет отрицательные часы', () => {
            withRequestContext(() => {
                expect(() =>
                    EmployeeHoursEntry.create({
                        employeeId: 42,
                        period: '2026-08',
                        hours: -1,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет период не в формате YYYY-MM', () => {
            withRequestContext(() => {
                expect(() =>
                    EmployeeHoursEntry.create({
                        employeeId: 42,
                        period: '2026/08',
                        hours: 10,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет некорректный id сотрудника', () => {
            withRequestContext(() => {
                expect(() =>
                    EmployeeHoursEntry.create({
                        employeeId: 0,
                        period: '2026-08',
                        hours: 10,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    describe('edit', () => {
        it('заменяет значение часов целиком', () => {
            const entry = EmployeeHoursEntry.create({
                employeeId: 42,
                period: '2026-08',
                hours: 160,
            });

            entry.edit(180);

            expect(entry.hours).toBe(180);
        });

        it('отклоняет правку в отрицательное значение', () => {
            const entry = EmployeeHoursEntry.create({
                employeeId: 42,
                period: '2026-08',
                hours: 160,
            });

            withRequestContext(() => {
                expect(() => entry.edit(-5)).toThrow(ArgumentInvalidException);
            });
        });
    });
});

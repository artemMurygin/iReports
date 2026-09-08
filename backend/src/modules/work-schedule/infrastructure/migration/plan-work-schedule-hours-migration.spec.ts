import {
    planWorkScheduleHoursMigration,
    scheduleDateKey,
} from './plan-work-schedule-hours-migration';

describe('planWorkScheduleHoursMigration', () => {
    it('пустой список записей — пустой план', () => {
        expect(planWorkScheduleHoursMigration([])).toEqual({
            items: [],
            skipped: [],
        });
    });

    it('переносит запись в чанки WORKING-смен, сумма которых равна исходным часам', () => {
        const plan = planWorkScheduleHoursMigration([
            { employeeId: 1, period: '2026-08', hours: 40 },
        ]);

        expect(plan.skipped).toEqual([]);
        expect(plan.items).toHaveLength(3); // 16 + 16 + 8
        expect(plan.items.every((item) => item.employeeId === 1)).toBe(true);
        expect(new Set(plan.items.map((item) => item.date)).size).toBe(
            plan.items.length,
        ); // разные дни, без дублей по (employeeId, date)
        expect(plan.items.reduce((sum, item) => sum + item.hours, 0)).toBe(40);
        // Даты в границах месяца периода.
        expect(
            plan.items.every((item) => item.date.startsWith('2026-08-')),
        ).toBe(true);
    });

    it('0 часов в записи — не переносится (findHoursWorked и так вернёт 0)', () => {
        const plan = planWorkScheduleHoursMigration([
            { employeeId: 1, period: '2026-08', hours: 0 },
        ]);

        expect(plan.items).toEqual([]);
        expect(plan.skipped).toEqual([]);
    });

    it('повторный запуск — сотрудник с уже существующей записью графика в месяце периода пропускается целиком (идемпотентность)', () => {
        const existing = new Set([scheduleDateKey(1, '2026-08-15')]);

        const plan = planWorkScheduleHoursMigration(
            [{ employeeId: 1, period: '2026-08', hours: 40 }],
            existing,
        );

        expect(plan.items).toEqual([]);
        expect(plan.skipped).toEqual([]);
    });

    it('другой сотрудник или другой период с существующей записью не блокируется чужим occupied-днём', () => {
        const existing = new Set([scheduleDateKey(2, '2026-08-01')]);

        const plan = planWorkScheduleHoursMigration(
            [{ employeeId: 1, period: '2026-08', hours: 8 }],
            existing,
        );

        expect(plan.items).toEqual([
            expect.objectContaining({ employeeId: 1, hours: 8 }),
        ]);
    });

    it('несколько записей разных сотрудников/периодов переносятся независимо', () => {
        const plan = planWorkScheduleHoursMigration([
            { employeeId: 1, period: '2026-08', hours: 8 },
            { employeeId: 2, period: '2026-07', hours: 16 },
        ]);

        expect(plan.items).toEqual([
            expect.objectContaining({
                employeeId: 1,
                date: '2026-08-01',
                hours: 8,
            }),
            expect.objectContaining({
                employeeId: 2,
                date: '2026-07-01',
                hours: 16,
            }),
        ]);
    });

    it('запись, которую нельзя перенести без искажения суммы, попадает в skipped, а не в items', () => {
        const plan = planWorkScheduleHoursMigration([
            { employeeId: 1, period: '2026-08', hours: 1.5 },
        ]);

        expect(plan.items).toEqual([]);
        expect(plan.skipped).toHaveLength(1);
        expect(plan.skipped[0]).toMatchObject({
            employeeId: 1,
            period: '2026-08',
        });
        expect(plan.skipped[0].reason).toContain('меньше минимальной смены');
    });
});

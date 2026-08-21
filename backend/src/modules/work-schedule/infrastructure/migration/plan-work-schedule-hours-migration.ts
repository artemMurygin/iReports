import { randomUUID } from 'crypto';
import { Period } from '@/shared/domain/period.value-object';
import { buildMonthDates } from '@/modules/work-schedule/domain/services/month-dates';
import { distributeMonthlyHours } from './distribute-monthly-hours';

// Форма старой EmployeeHoursEntry (Фаза 5, docs/employee-work-schedule) —
// описана здесь, а не как срез Prisma-модели (модель уже удалена этой же
// фазой), чтобы функцию планирования можно было тестировать без БД, тем же
// приёмом, что и planEmployeeIdentityMigration (Фаза 2).
export interface LegacyEmployeeHoursEntry {
    employeeId: number;
    period: string;
    hours: number;
}

export interface WorkScheduleHoursMigrationItem {
    id: string;
    employeeId: number;
    date: string;
    hours: number;
}

export interface WorkScheduleHoursMigrationSkip {
    employeeId: number;
    period: string;
    reason: string;
}

export interface WorkScheduleHoursMigrationPlan {
    items: WorkScheduleHoursMigrationItem[];
    skipped: WorkScheduleHoursMigrationSkip[];
}

export function scheduleDateKey(employeeId: number, date: string): string {
    return `${employeeId}:${date}`;
}

// Идемпотентная чистая функция: переносит записи EmployeeHoursEntry в
// записи графика (WorkScheduleEntry.status = WORKING), распределяя часы
// периода по дням через distributeMonthlyHours. Не делает запросов к БД
// сама (см. plan-employee-identity-migration.ts, тот же приём).
//
// `existingScheduleDates` — уже занятые пары (сотрудник, день) ЛЮБОГО
// статуса. Если у сотрудника в месяце периода есть хотя бы одна такая
// запись — весь период для него пропускается целиком (а не только занятые
// дни): это и повторный безопасный запуск (записи уже перенесены прошлым
// запуском попадают в existingScheduleDates), и защита ручного
// заполнения графика (кто-то уже начал проставлять этот месяц вручную) от
// задвоения часов поверх него — миграция никогда не подмешивает свои дни к
// частично заполненному месяцу.
export function planWorkScheduleHoursMigration(
    entries: readonly LegacyEmployeeHoursEntry[],
    existingScheduleDates: ReadonlySet<string> = new Set(),
): WorkScheduleHoursMigrationPlan {
    const items: WorkScheduleHoursMigrationItem[] = [];
    const skipped: WorkScheduleHoursMigrationSkip[] = [];

    for (const entry of entries) {
        if (entry.hours <= 0) {
            // 0 (или отрицательное — EmployeeHoursEntry.validate() не
            // допускала, но защищаемся) часов — findHoursWorked и так
            // вернёт 0 без единой записи графика, переносить нечего.
            continue;
        }

        const period = Period.create(entry.period);
        const dates = buildMonthDates(period);
        const hasExistingScheduleInPeriod = dates.some((date) =>
            existingScheduleDates.has(scheduleDateKey(entry.employeeId, date)),
        );
        if (hasExistingScheduleInPeriod) {
            continue;
        }

        try {
            const chunks = distributeMonthlyHours(entry.hours, dates);
            for (const chunk of chunks) {
                items.push({
                    id: randomUUID(),
                    employeeId: entry.employeeId,
                    date: chunk.date,
                    hours: chunk.hours,
                });
            }
        } catch (error) {
            skipped.push({
                employeeId: entry.employeeId,
                period: entry.period,
                reason: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return { items, skipped };
}

import { Inject, Injectable } from '@nestjs/common';
import type {
    MonthlyWorkScheduleResponse,
    WorkScheduleDayAggregate,
    WorkScheduleDayCell,
    WorkScheduleEmployeeRow,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type {
    DirectoryRepositoryPort,
    EmployeeSummary,
} from '@/modules/directory/application/ports/directory.port';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { buildMonthDates } from '@/modules/work-schedule/domain/services/month-dates';
import { roundHours } from '@/modules/work-schedule/domain/services/hours-rounding';
import { ANNUAL_VACATION_DAYS_LIMIT } from '@/modules/work-schedule/domain/constants/annual-vacation-limit';

// GET /v1/work-schedule?month=&departmentId= (Фаза 3, docs/employee-work-schedule)
// — вся таблица «сотрудники × дни месяца» одним ответом: без неё фронту
// пришлось бы собирать её из 13+ отдельных запросов на сотрудника (см. PRD,
// "Технические ограничения").
//
// Запросов к БД ровно два, независимо от числа сотрудников и дней месяца
// (см. "Когда готово" Фазы 3 — "фиксированное число SQL-запросов"):
//  1. список сотрудников отдела (DirectoryRepositoryPort.findEmployees);
//  2. все их записи графика за КАЛЕНДАРНЫЙ ГОД месяца (не только за сам
//     месяц) — год всегда целиком содержит месяц, а второй запрос отдельно
//     под "использованные дни отпуска за год" (PRD, сценарий "видно остаток
//     дней отпуска на текущий год") не нужен: используем ту же выборку.
// Вся агрегация (итоги по сотруднику, «человек в смене» по дню, фонд часов
// месяца) считается здесь, в памяти, а не в браузере (PRD, "Технические
// ограничения").
@Injectable()
export class GetMonthlyWorkScheduleService {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directory: DirectoryRepositoryPort,
        @Inject(WORK_SCHEDULE_ENTRY_REPOSITORY)
        private readonly repo: WorkScheduleEntryRepositoryPort,
    ) {}

    async execute(
        month: string,
        departmentId?: number,
    ): Promise<MonthlyWorkScheduleResponse> {
        const period = Period.create(month);
        const dates = buildMonthDates(period);

        const employees = await this.directory.findEmployees(departmentId);
        const employeeIds = employees.map((employee) => employee.id);

        const entries = await this.fetchYearEntries(period, employeeIds);
        const entriesByEmployee = groupByEmployeeAndDate(entries);

        // Аккумуляторы дневных агрегатов — по индексу дня, параллельно
        // dates: buildEmployeeRow заполняет их по ходу сборки ячеек
        // сотрудника, поэтому агрегаты «человек в смене»/фонд часов дня
        // ниже собираются без повторного прохода по всем сотрудникам.
        const peopleOnShiftByDay = new Array<number>(dates.length).fill(0);
        const hoursByDay = new Array<number>(dates.length).fill(0);

        const employeeRows = employees.map((employee) =>
            this.buildEmployeeRow(
                employee,
                entriesByEmployee.get(employee.id),
                dates,
                peopleOnShiftByDay,
                hoursByDay,
            ),
        );

        const days: WorkScheduleDayAggregate[] = dates.map((date, index) => ({
            date,
            peopleOnShift: peopleOnShiftByDay[index],
        }));

        const totalHours = roundHours(
            hoursByDay.reduce((sum, hours) => sum + hours, 0),
        );

        return {
            month: period.getValue(),
            departmentId: departmentId ?? null,
            employees: employeeRows,
            days,
            totalHours,
        };
    }

    // Границы КАЛЕНДАРНОГО ГОДА месяца из запроса — год всегда полностью
    // содержит сам месяц, поэтому одной выборкой закрываются и ячейки
    // таблицы (фильтруются по месяцу ниже, в buildEmployeeRow), и годовой
    // счётчик отпуска.
    private async fetchYearEntries(
        period: Period,
        employeeIds: number[],
    ): Promise<WorkScheduleEntry[]> {
        if (employeeIds.length === 0) {
            return [];
        }
        const year = Number(period.getValue().slice(0, 4));
        const yearFrom = new Date(Date.UTC(year, 0, 1));
        const yearTo = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
        return this.repo.findByEmployeeIdsAndDateRange(
            employeeIds,
            yearFrom,
            yearTo,
        );
    }

    private buildEmployeeRow(
        employee: EmployeeSummary,
        employeeEntriesByDate: Map<string, WorkScheduleEntry> | undefined,
        dates: string[],
        peopleOnShiftByDay: number[],
        hoursByDay: number[],
    ): WorkScheduleEmployeeRow {
        const employeeEntries =
            employeeEntriesByDate ?? new Map<string, WorkScheduleEntry>();

        // Отпуск считается за весь год выборки, а не только за
        // отображаемый месяц — см. комментарий над классом.
        let vacationDaysUsed = 0;
        for (const entry of employeeEntries.values()) {
            if (entry.day.status === 'VACATION') {
                vacationDaysUsed += 1;
            }
        }

        let totalHours = 0;
        const days: WorkScheduleDayCell[] = dates.map((date, index) => {
            const entry = employeeEntries.get(date);
            if (!entry) {
                // День вне графика — пустая ячейка, а не ошибка (см. PRD,
                // критерий готовности "для месяца без данных — пустые
                // ячейки без ошибки").
                return {
                    date,
                    entryId: null,
                    status: null,
                    hours: null,
                    role: null,
                };
            }

            if (entry.day.isWorking()) {
                peopleOnShiftByDay[index] += 1;
                if (entry.day.hours) {
                    totalHours += entry.day.hours;
                    hoursByDay[index] += entry.day.hours;
                }
            }

            return {
                date,
                entryId: entry.id,
                status: entry.day.status,
                hours: entry.day.hours,
                role: entry.day.role,
            };
        });

        return {
            employeeId: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            departmentId: employee.departmentId,
            days,
            totalHours: roundHours(totalHours),
            vacationDaysUsed,
            vacationDaysLimit: ANNUAL_VACATION_DAYS_LIMIT,
        };
    }
}

// Группировка выборки года по (сотрудник → дата → запись) — одна выборка
// (repo.findByEmployeeIdsAndDateRange) раскладывается в память один раз, а
// дальше и ячейки месяца, и счётчик отпуска читают из неё без повторных
// проходов по всему массиву entries.
function groupByEmployeeAndDate(
    entries: WorkScheduleEntry[],
): Map<number, Map<string, WorkScheduleEntry>> {
    const byEmployee = new Map<number, Map<string, WorkScheduleEntry>>();
    for (const entry of entries) {
        let byDate = byEmployee.get(entry.employeeId);
        if (!byDate) {
            byDate = new Map();
            byEmployee.set(entry.employeeId, byDate);
        }
        byDate.set(entry.date.getValue(), entry);
    }
    return byEmployee;
}

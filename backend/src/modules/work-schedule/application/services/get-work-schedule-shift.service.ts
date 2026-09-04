import { Inject, Injectable } from '@nestjs/common';
import { targetRoleSchema } from 'ireports-contracts';
import type {
    WorkScheduleAbsenceGroup,
    WorkScheduleAbsenceReason,
    WorkScheduleShiftEmployee,
    WorkScheduleShiftResponse,
    WorkScheduleShiftRoleCount,
} from 'ireports-contracts';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { WORK_SCHEDULE_ENTRY_REPOSITORY } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import type { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { roundHours } from '@/modules/work-schedule/domain/services/hours-rounding';

// Порядок причин отсутствия в ответе — фиксированный, а не «в порядке
// встречи в данных»: мобильный экран «Отдел сегодня» (узел A5SbT) рисует
// блоки причин в одном и том же порядке независимо от того, кто сегодня
// отсутствует.
const ABSENCE_REASON_ORDER: WorkScheduleAbsenceReason[] = [
    'DAY_OFF',
    'TIME_OFF',
    'SICK_LEAVE',
    'VACATION',
    'NOT_FILLED',
];

// GET /v1/work-schedule/shift?date=&departmentId= (Фаза 4,
// docs/employee-work-schedule) — состав смены на дату для мобильного экрана
// «Отдел сегодня»: два запроса к БД независимо от числа сотрудников (список
// сотрудников отдела + записи графика за один день), тем же приёмом, что и
// GetMonthlyWorkScheduleService (Фаза 3).
@Injectable()
export class GetWorkScheduleShiftService {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directory: DirectoryRepositoryPort,
        @Inject(WORK_SCHEDULE_ENTRY_REPOSITORY)
        private readonly repo: WorkScheduleEntryRepositoryPort,
    ) {}

    async execute(
        date: string,
        departmentId?: number,
    ): Promise<WorkScheduleShiftResponse> {
        // Валидация формата уже прошла в контроллере (Zod-схема query), но
        // ScheduleDate ещё и проверяет, что дата календарно существует —
        // тот же VO, что и у записи графика (единое место разбора даты).
        const scheduleDate = ScheduleDate.create(date);

        // includeServiceAccounts: true (docs/employee-ordering-and-salary-filter,
        // Фаза 3) — состав смены обязан продолжать показывать служебных
        // аккаунтов без изменений, тот же приём, что и в
        // GetMonthlyWorkScheduleService (см. WHY там).
        const employees = await this.directory.findEmployees(departmentId, {
            includeServiceAccounts: true,
        });
        const employeeIds = employees.map((employee) => employee.id);

        const entries = await this.fetchDayEntries(scheduleDate, employeeIds);
        const entryByEmployee = new Map(
            entries.map((entry) => [entry.employeeId, entry]),
        );

        const onShift: WorkScheduleShiftEmployee[] = [];
        const roleCounts = new Map<string, number>();
        let totalHours = 0;
        // Группируем «не на смене» по причине — Map сохраняет порядок
        // первой вставки ключа, но порядок ответа всё равно фиксируется
        // явно через ABSENCE_REASON_ORDER ниже, а не полагается на него.
        const absenceGroups = new Map<
            WorkScheduleAbsenceReason,
            { employeeId: number; name: string }[]
        >();

        for (const employee of employees) {
            const entry = entryByEmployee.get(employee.id);
            const name = `${employee.firstName} ${employee.lastName}`;

            if (entry && entry.day.isWorking()) {
                onShift.push({
                    employeeId: employee.id,
                    name,
                    role: entry.day.role,
                    hours: entry.day.hours,
                });
                if (entry.day.role) {
                    roleCounts.set(
                        entry.day.role,
                        (roleCounts.get(entry.day.role) ?? 0) + 1,
                    );
                }
                if (entry.day.hours) {
                    totalHours += entry.day.hours;
                }
                continue;
            }

            // Есть запись, но статус не WORKING — причина отсутствия это
            // сам статус дня; записи нет вообще — сотрудник «не заполнен»
            // (см. PRD, критерий готовности Фазы 4).
            const reason: WorkScheduleAbsenceReason = entry
                ? (entry.day.status as WorkScheduleAbsenceReason)
                : 'NOT_FILLED';
            this.pushToGroup(absenceGroups, reason, {
                employeeId: employee.id,
                name,
            });
        }

        const notOnShift: WorkScheduleAbsenceGroup[] = ABSENCE_REASON_ORDER
            // Пустые причины не отдаём — фронту незачем рендерить пустой
            // блок (см. комментарий в контракте).
            .filter((reason) => absenceGroups.has(reason))
            .map((reason) => ({
                reason,
                employees: absenceGroups.get(reason) ?? [],
            }));

        const roleCountsResponse: WorkScheduleShiftRoleCount[] =
            targetRoleSchema.options
                .filter((role) => roleCounts.has(role))
                .map((role) => ({
                    role,
                    count: roleCounts.get(role) as number,
                }));

        return {
            date: scheduleDate.getValue(),
            departmentId: departmentId ?? null,
            onShift,
            notOnShift,
            roleCounts: roleCountsResponse,
            totalHours: roundHours(totalHours),
        };
    }

    private async fetchDayEntries(
        date: ScheduleDate,
        employeeIds: number[],
    ): Promise<WorkScheduleEntry[]> {
        if (employeeIds.length === 0) {
            return [];
        }
        const dayStart = date.toDate();
        return this.repo.findByEmployeeIdsAndDateRange(
            employeeIds,
            dayStart,
            dayStart,
        );
    }

    private pushToGroup(
        groups: Map<
            WorkScheduleAbsenceReason,
            { employeeId: number; name: string }[]
        >,
        reason: WorkScheduleAbsenceReason,
        employee: { employeeId: number; name: string },
    ): void {
        const group = groups.get(reason);
        if (group) {
            group.push(employee);
        } else {
            groups.set(reason, [employee]);
        }
    }
}

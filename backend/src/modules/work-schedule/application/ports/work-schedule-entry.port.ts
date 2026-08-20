import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';

export interface WorkScheduleEntryRepositoryPort {
    insert(entity: WorkScheduleEntry): Promise<void>;
    update(entity: WorkScheduleEntry): Promise<void>;
    delete(id: string): Promise<void>;
    findById(id: string): Promise<WorkScheduleEntry | null>;

    // Естественный ключ записи — вход upsert'а: сначала ищем день
    // сотрудника, потом решаем, вставлять или править (@@unique в
    // work-schedule.prisma — последняя линия защиты).
    findByEmployeeAndDate(
        employeeId: number,
        date: string,
    ): Promise<WorkScheduleEntry | null>;

    // Одна выборка на группу сотрудников и диапазон дат — источник и
    // месячной таблицы графика, и годового счётчика отпуска (Фаза 3,
    // GetMonthlyWorkScheduleService передаёт границы КАЛЕНДАРНОГО ГОДА
    // месяца, не только сам месяц, — год всегда включает месяц целиком, а
    // второй запрос не нужен). Один вызов на весь отдел, а не по одному на
    // сотрудника/день — иначе таблица 13+ сотрудников × 31 день дала бы
    // N+1 (см. PRD, "Технические ограничения").
    findByEmployeeIdsAndDateRange(
        employeeIds: number[],
        from: Date,
        to: Date,
    ): Promise<WorkScheduleEntry[]>;
}

export const WORK_SCHEDULE_ENTRY_REPOSITORY = Symbol(
    'WORK_SCHEDULE_ENTRY_REPOSITORY',
);

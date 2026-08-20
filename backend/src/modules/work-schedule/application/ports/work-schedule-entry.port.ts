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
}

export const WORK_SCHEDULE_ENTRY_REPOSITORY = Symbol(
    'WORK_SCHEDULE_ENTRY_REPOSITORY',
);

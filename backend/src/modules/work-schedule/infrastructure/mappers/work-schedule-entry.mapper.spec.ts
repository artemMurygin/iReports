import { WorkScheduleEntryMapper } from './work-schedule-entry.mapper';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';

describe('WorkScheduleEntryMapper', () => {
    const mapper = new WorkScheduleEntryMapper();

    it('toDomain восстанавливает рабочий день из записи БД', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'entry-1',
            employeeId: 42,
            date: new Date('2026-08-05T00:00:00.000Z'),
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
            isOnDuty: false,
            createdAt: now,
            updatedAt: now,
        });

        expect(entity).toBeInstanceOf(WorkScheduleEntry);
        expect(entity.id).toBe('entry-1');
        expect(entity.employeeId).toBe(42);
        expect(entity.date.getValue()).toBe('2026-08-05');
        expect(entity.day.status).toBe('WORKING');
        expect(entity.day.hours).toBe(8);
        expect(entity.day.role).toBe('ENGINEER');
    });

    it('toDomain восстанавливает нерабочий день с null-часами/ролью', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'entry-2',
            employeeId: 7,
            date: new Date('2026-08-06T00:00:00.000Z'),
            status: 'VACATION',
            hours: null,
            role: null,
            isOnDuty: false,
            createdAt: now,
            updatedAt: now,
        });

        expect(entity.day.status).toBe('VACATION');
        expect(entity.day.hours).toBeNull();
        expect(entity.day.role).toBeNull();
    });

    it('toPersistence сериализует сущность в плоскую запись БД', () => {
        const entity = WorkScheduleEntry.create({
            employeeId: 42,
            date: ScheduleDate.create('2026-08-05'),
            day: WorkDay.create({
                status: 'WORKING',
                hours: 8,
                role: 'ENGINEER',
            }),
        });

        const record = mapper.toPersistence(entity);

        expect(record).toMatchObject({
            id: entity.id,
            employeeId: 42,
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
        });
        expect(record.date).toBeInstanceOf(Date);
        expect((record.date as Date).toISOString()).toBe(
            '2026-08-05T00:00:00.000Z',
        );
    });

    it('toDomain → toPersistence не теряет и не искажает данные', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'entry-3',
            employeeId: 7,
            date: new Date('2026-08-06T00:00:00.000Z'),
            status: 'DAY_OFF',
            hours: null,
            role: null,
            isOnDuty: false,
            createdAt: now,
            updatedAt: now,
        });

        const record = mapper.toPersistence(entity);

        expect(record).toMatchObject({
            id: 'entry-3',
            employeeId: 7,
            status: 'DAY_OFF',
            hours: null,
            role: null,
        });
    });

    it('toDomain → toPersistence сохраняет отметку дежурства (true)', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'entry-4',
            employeeId: 42,
            date: new Date('2026-08-05T00:00:00.000Z'),
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
            isOnDuty: true,
            createdAt: now,
            updatedAt: now,
        });

        expect(entity.day.isOnDuty).toBe(true);

        const record = mapper.toPersistence(entity);

        expect(record.isOnDuty).toBe(true);
    });

    it('toDomain → toPersistence сохраняет отметку дежурства (false)', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'entry-5',
            employeeId: 42,
            date: new Date('2026-08-05T00:00:00.000Z'),
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
            isOnDuty: false,
            createdAt: now,
            updatedAt: now,
        });

        expect(entity.day.isOnDuty).toBe(false);

        const record = mapper.toPersistence(entity);

        expect(record.isOnDuty).toBe(false);
    });
});

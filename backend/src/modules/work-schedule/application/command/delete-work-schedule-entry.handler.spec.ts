import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteWorkScheduleEntryHandler } from './delete-work-schedule-entry.handler';
import { DeleteWorkScheduleEntryCommand } from './delete-work-schedule-entry.command';
import type { WorkScheduleEntryRepositoryPort } from '../ports/work-schedule-entry.port';
import { WorkScheduleEntryNotFoundException } from '@/modules/work-schedule/domain/exceptions/work-schedule-entry.exception';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';

describe('DeleteWorkScheduleEntryHandler', () => {
    const buildHandler = (existing: WorkScheduleEntry | null) => {
        const deleteFn = jest.fn().mockResolvedValue(undefined);
        const findById = jest.fn().mockResolvedValue(existing);
        const repo: WorkScheduleEntryRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: deleteFn,
            findById,
            findByEmployeeAndDate: jest.fn(),
        };
        const handler = new DeleteWorkScheduleEntryHandler(repo);
        return { handler, deleteFn, findById };
    };

    it('удаляет существующую запись', async () => {
        await withRequestContext(async () => {
            const existing = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: WorkDay.create({ status: 'WORKING', hours: 8 }),
            });
            const { handler, deleteFn } = buildHandler(existing);

            await handler.execute(
                new DeleteWorkScheduleEntryCommand({ entryId: existing.id }),
            );

            expect(deleteFn).toHaveBeenCalledWith(existing.id);
        });
    });

    it('отклоняет удаление несуществующей записи (→ 404)', async () => {
        await withRequestContext(async () => {
            const { handler, deleteFn } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteWorkScheduleEntryCommand({ entryId: 'missing' }),
                ),
            ).rejects.toBeInstanceOf(WorkScheduleEntryNotFoundException);
            expect(deleteFn).not.toHaveBeenCalled();
        });
    });
});

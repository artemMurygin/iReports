import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteWorkScheduleEntryHandler } from './delete-work-schedule-entry.handler';
import { DeleteWorkScheduleEntryCommand } from './delete-work-schedule-entry.command';
import type { WorkScheduleEntryRepositoryPort } from '../ports/work-schedule-entry.port';
import { WorkScheduleEntryNotFoundException } from '@/modules/work-schedule/domain/exceptions/work-schedule-entry.exception';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import type { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';

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
        const ensureNotClosed = jest.fn().mockResolvedValue(undefined);
        const ensurePeriodNotClosed = {
            ensureNotClosed,
        } as unknown as EnsurePeriodNotClosedService;
        const handler = new DeleteWorkScheduleEntryHandler(
            repo,
            ensurePeriodNotClosed,
        );
        return { handler, deleteFn, findById, ensureNotClosed };
    };

    it('удаляет существующую запись', async () => {
        await withRequestContext(async () => {
            const existing = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: WorkDay.create({ status: 'WORKING', hours: 8 }),
            });
            const { handler, deleteFn, ensureNotClosed } =
                buildHandler(existing);

            await handler.execute(
                new DeleteWorkScheduleEntryCommand({ entryId: existing.id }),
            );

            expect(ensureNotClosed).toHaveBeenCalledWith('2026-08');
            expect(deleteFn).toHaveBeenCalledWith(existing.id);
        });
    });

    it('отклоняет удаление несуществующей записи (→ 404)', async () => {
        await withRequestContext(async () => {
            const { handler, deleteFn, ensureNotClosed } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteWorkScheduleEntryCommand({ entryId: 'missing' }),
                ),
            ).rejects.toBeInstanceOf(WorkScheduleEntryNotFoundException);
            expect(deleteFn).not.toHaveBeenCalled();
            expect(ensureNotClosed).not.toHaveBeenCalled();
        });
    });

    it('пробрасывает исключение и не удаляет запись, если месяц дня закрыт', async () => {
        await withRequestContext(async () => {
            const existing = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: WorkDay.create({ status: 'WORKING', hours: 8 }),
            });
            const { handler, deleteFn, ensureNotClosed } =
                buildHandler(existing);
            const closedError = new Error('period closed');
            ensureNotClosed.mockRejectedValue(closedError);

            await expect(
                handler.execute(
                    new DeleteWorkScheduleEntryCommand({
                        entryId: existing.id,
                    }),
                ),
            ).rejects.toBe(closedError);
            expect(deleteFn).not.toHaveBeenCalled();
        });
    });
});

import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { UpsertWorkScheduleEntryHandler } from './upsert-work-schedule-entry.handler';
import { UpsertWorkScheduleEntryCommand } from './upsert-work-schedule-entry.command';
import type { WorkScheduleEntryRepositoryPort } from '../ports/work-schedule-entry.port';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import type { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/accounting-period/ensure-period-not-closed.service';

describe('UpsertWorkScheduleEntryHandler', () => {
    const buildHandler = (existing: WorkScheduleEntry | null) => {
        const insert = jest.fn().mockResolvedValue(undefined);
        const update = jest.fn().mockResolvedValue(undefined);
        const findByEmployeeAndDate = jest.fn().mockResolvedValue(existing);
        const repo: WorkScheduleEntryRepositoryPort = {
            insert,
            update,
            delete: jest.fn(),
            findById: jest.fn(),
            findByEmployeeAndDate,
        };
        const ensureNotClosed = jest.fn().mockResolvedValue(undefined);
        const ensurePeriodNotClosed = {
            ensureNotClosed,
        } as unknown as EnsurePeriodNotClosedService;
        const handler = new UpsertWorkScheduleEntryHandler(
            repo,
            ensurePeriodNotClosed,
        );
        return {
            handler,
            insert,
            update,
            findByEmployeeAndDate,
            ensureNotClosed,
        };
    };

    const buildCommand = (
        overrides: Partial<{
            employeeId: number;
            date: string;
            status:
                'WORKING' | 'DAY_OFF' | 'TIME_OFF' | 'SICK_LEAVE' | 'VACATION';
            hours?: number;
            role?: string;
            isOnDuty?: boolean;
        }> = {},
    ) =>
        new UpsertWorkScheduleEntryCommand({
            employeeId: 42,
            date: '2026-08-05',
            status: 'WORKING',
            hours: 8,
            role: 'ENGINEER',
            ...overrides,
        } as never);

    it('создаёт новую запись, если дня ещё нет у сотрудника', async () => {
        await withRequestContext(async () => {
            const {
                handler,
                insert,
                update,
                findByEmployeeAndDate,
                ensureNotClosed,
            } = buildHandler(null);

            const result = await handler.execute(buildCommand());

            expect(ensureNotClosed).toHaveBeenCalledWith('2026-08');
            expect(findByEmployeeAndDate).toHaveBeenCalledWith(
                42,
                '2026-08-05',
            );
            expect(insert).toHaveBeenCalledTimes(1);
            expect(update).not.toHaveBeenCalled();
            expect(result).toMatchObject({
                employeeId: 42,
                date: '2026-08-05',
                status: 'WORKING',
                hours: 8,
                role: 'ENGINEER',
            });
        });
    });

    it('пробрасывает исключение и не пишет запись, если месяц дня закрыт', async () => {
        await withRequestContext(async () => {
            const { handler, insert, update, ensureNotClosed } =
                buildHandler(null);
            const closedError = new Error('period closed');
            ensureNotClosed.mockRejectedValue(closedError);

            await expect(handler.execute(buildCommand())).rejects.toBe(
                closedError,
            );
            expect(insert).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('повторный upsert на ту же пару (сотрудник, дата) правит запись, а не создаёт вторую', async () => {
        await withRequestContext(async () => {
            const existing = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: WorkDay.create({ status: 'DAY_OFF' }),
            });
            const { handler, insert, update } = buildHandler(existing);

            const result = await handler.execute(
                buildCommand({
                    status: 'WORKING',
                    hours: 6,
                    role: 'ONLINE_MANAGER',
                }),
            );

            expect(insert).not.toHaveBeenCalled();
            expect(update).toHaveBeenCalledTimes(1);
            expect(update).toHaveBeenCalledWith(existing);
            expect(result.id).toBe(existing.id);
            expect(result.status).toBe('WORKING');
            expect(result.hours).toBe(6);
        });
    });

    it('создаёт новую запись с отметкой isOnDuty: true', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler(null);

            const result = await handler.execute(
                buildCommand({ isOnDuty: true }),
            );

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result.isOnDuty).toBe(true);
        });
    });

    it('повторный upsert с isOnDuty: false снимает ранее выставленную отметку', async () => {
        await withRequestContext(async () => {
            const existing = WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-08-05'),
                day: WorkDay.create({
                    status: 'WORKING',
                    hours: 8,
                    role: 'ENGINEER',
                    isOnDuty: true,
                }),
            });
            const { handler, update } = buildHandler(existing);

            const result = await handler.execute(
                buildCommand({ isOnDuty: false }),
            );

            expect(update).toHaveBeenCalledTimes(1);
            expect(result.isOnDuty).toBe(false);
        });
    });

    it('отклоняет часы вне диапазона 2–16 ArgumentInvalidException (→ 400)', async () => {
        await withRequestContext(async () => {
            const { handler, insert, update } = buildHandler(null);

            await expect(
                handler.execute(buildCommand({ hours: 20 })),
            ).rejects.toBeInstanceOf(ArgumentInvalidException);
            expect(insert).not.toHaveBeenCalled();
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('отклоняет часы, переданные с не-WORKING статусом ArgumentInvalidException (→ 400)', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler(null);

            await expect(
                handler.execute(
                    buildCommand({
                        status: 'DAY_OFF',
                        hours: 8,
                        role: undefined,
                    }),
                ),
            ).rejects.toBeInstanceOf(ArgumentInvalidException);
            expect(insert).not.toHaveBeenCalled();
        });
    });

    it('отклоняет роль, переданную с не-WORKING статусом ArgumentInvalidException (→ 400)', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler(null);

            await expect(
                handler.execute(
                    buildCommand({
                        status: 'SICK_LEAVE',
                        hours: undefined,
                        role: 'ENGINEER',
                    }),
                ),
            ).rejects.toBeInstanceOf(ArgumentInvalidException);
            expect(insert).not.toHaveBeenCalled();
        });
    });
});

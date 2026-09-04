import { EnsurePeriodNotClosedService } from './ensure-period-not-closed.service';
import { UpsertWorkScheduleEntryHandler } from '@/modules/work-schedule/application/command/upsert-work-schedule-entry.handler';
import { UpsertWorkScheduleEntryCommand } from '@/modules/work-schedule/application/command/upsert-work-schedule-entry.command';
import { DeleteWorkScheduleEntryHandler } from '@/modules/work-schedule/application/command/delete-work-schedule-entry.handler';
import { DeleteWorkScheduleEntryCommand } from '@/modules/work-schedule/application/command/delete-work-schedule-entry.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { WorkScheduleEntryRepositoryPort } from '@/modules/work-schedule/application/ports/work-schedule-entry.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { WorkScheduleEntry } from '@/modules/work-schedule/domain/entities/work-schedule-entry.entity';
import { ScheduleDate } from '@/modules/work-schedule/domain/value-objects/schedule-date.value-object';
import { WorkDay } from '@/modules/work-schedule/domain/value-objects/work-day.value-object';
import { AccountingPeriodClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Блокировка часов закрытого месяца (PRD 1 docs/payroll-closing-and-accrual,
// "Блокировка графика работы и ручных часов"): единый сервис проверки,
// подключённый к обоим хендлерам записи графика работы (Фаза 5
// docs/employee-work-schedule заменила прежний ручной ввод EmployeeHoursEntry
// графиком — источник часов другой, гард тот же самый, не задублирован).
describe('EnsurePeriodNotClosedService — блокировка WorkScheduleEntry', () => {
    const createPeriodStore = () => {
        const store = new Map<string, AccountingPeriod>();
        const key = (direction: AccountingDirection, period: string) =>
            `${direction}:${period}`;
        const periodRepo: AccountingPeriodRepositoryPort = {
            findByDirectionAndPeriod: (direction, period) =>
                Promise.resolve(store.get(key(direction, period)) ?? null),
            save: (entity) => {
                store.set(key(entity.direction, entity.period), entity);
                return Promise.resolve();
            },
        };
        const closePeriod = (
            direction: AccountingDirection,
            period: string,
            closedBy = 7,
        ) =>
            withRequestContext(() => {
                const entity = AccountingPeriod.openFor({ direction, period });
                entity.close(closedBy, 0);
                store.set(key(direction, period), entity);
                return entity;
            });
        return { store, key, periodRepo, closePeriod };
    };

    const createScheduleRepo = (entries: WorkScheduleEntry[]) => {
        const byId = new Map(entries.map((entry) => [entry.id, entry]));
        const insert = jest.fn().mockResolvedValue(undefined);
        const update = jest.fn().mockResolvedValue(undefined);
        const remove = jest.fn().mockResolvedValue(undefined);
        const repo: WorkScheduleEntryRepositoryPort = {
            insert,
            update,
            delete: remove,
            findById: (id) => Promise.resolve(byId.get(id) ?? null),
            findByEmployeeAndDate: (employeeId, date) =>
                Promise.resolve(
                    entries.find(
                        (entry) =>
                            entry.employeeId === employeeId &&
                            entry.date.getValue() === date,
                    ) ?? null,
                ),
            findByEmployeeIdsAndDateRange: jest.fn().mockResolvedValue([]),
        };
        return { repo, insert, update, remove };
    };

    const setup = () => {
        const periods = createPeriodStore();
        const guard = new EnsurePeriodNotClosedService(periods.periodRepo);
        const julyEntry = withRequestContext(() =>
            WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-07-15'),
                day: WorkDay.create({ status: 'WORKING', hours: 8 }),
            }),
        );
        const juneEntry = withRequestContext(() =>
            WorkScheduleEntry.create({
                employeeId: 42,
                date: ScheduleDate.create('2026-06-15'),
                day: WorkDay.create({ status: 'WORKING', hours: 8 }),
            }),
        );
        const schedule = createScheduleRepo([julyEntry, juneEntry]);
        return {
            ...periods,
            ...schedule,
            guard,
            julyEntry,
            juneEntry,
            upsertHandler: new UpsertWorkScheduleEntryHandler(
                schedule.repo,
                guard,
            ),
            deleteHandler: new DeleteWorkScheduleEntryHandler(
                schedule.repo,
                guard,
            ),
        };
    };

    it('PUT/DELETE записи графика закрытого месяца → 409 AccountingPeriodClosedException с closedBy/closedAt', async () => {
        const ctx = setup();
        const closed = ctx.closePeriod('service', '2026-07', 7);

        const errors = await withRequestContext(() =>
            Promise.all([
                ctx.upsertHandler
                    .execute(
                        new UpsertWorkScheduleEntryCommand({
                            employeeId: 99,
                            date: '2026-07-20',
                            status: 'WORKING',
                            hours: 8,
                        }),
                    )
                    .catch((e: unknown) => e),
                ctx.deleteHandler
                    .execute(
                        new DeleteWorkScheduleEntryCommand({
                            entryId: ctx.julyEntry.id,
                        }),
                    )
                    .catch((e: unknown) => e),
            ]),
        );

        for (const error of errors) {
            expect(error).toBeInstanceOf(AccountingPeriodClosedException);
            expect((error as AccountingPeriodClosedException).metadata).toEqual(
                {
                    direction: 'service',
                    period: '2026-07',
                    closedBy: 7,
                    closedAt: closed.closedAt,
                },
            );
        }
        expect(ctx.insert).not.toHaveBeenCalled();
        expect(ctx.update).not.toHaveBeenCalled();
        expect(ctx.remove).not.toHaveBeenCalled();
    });

    it('запись графика другого (открытого) месяца правится, когда закрыт соседний', async () => {
        const ctx = setup();
        ctx.closePeriod('service', '2026-07');

        await withRequestContext(async () => {
            await ctx.upsertHandler.execute(
                new UpsertWorkScheduleEntryCommand({
                    employeeId: ctx.juneEntry.employeeId,
                    date: ctx.juneEntry.date.getValue(),
                    status: 'WORKING',
                    hours: 6,
                }),
            );
            await ctx.deleteHandler.execute(
                new DeleteWorkScheduleEntryCommand({
                    entryId: ctx.juneEntry.id,
                }),
            );
        });

        expect(ctx.update).toHaveBeenCalledTimes(1);
        expect(ctx.remove).toHaveBeenCalledTimes(1);
    });

    it('график — общий источник PayPerHour обоих направлений: закрытие месяца по shop тоже блокирует его', async () => {
        const ctx = setup();
        ctx.closePeriod('shop', '2026-07', 5);

        const error = await withRequestContext(() =>
            ctx.deleteHandler
                .execute(
                    new DeleteWorkScheduleEntryCommand({
                        entryId: ctx.julyEntry.id,
                    }),
                )
                .catch((e: unknown) => e),
        );

        expect(error).toBeInstanceOf(AccountingPeriodClosedException);
        expect(
            (error as AccountingPeriodClosedException).metadata,
        ).toMatchObject({ direction: 'shop', closedBy: 5 });
    });

    it('проверка по явному направлению: закрытый shop не блокирует источник, привязанный только к service', async () => {
        const ctx = setup();
        ctx.closePeriod('shop', '2026-07');

        await expect(
            ctx.guard.ensureNotClosed('2026-07', ['service']),
        ).resolves.toBeUndefined();
        await expect(
            withRequestContext(() =>
                ctx.guard.ensureNotClosed('2026-07', ['shop']),
            ),
        ).rejects.toBeInstanceOf(AccountingPeriodClosedException);
    });

    it('после reopen блокировка снимается — запись графика снова редактируется', async () => {
        const ctx = setup();
        const closed = ctx.closePeriod('service', '2026-07');

        await expect(
            withRequestContext(() =>
                ctx.deleteHandler.execute(
                    new DeleteWorkScheduleEntryCommand({
                        entryId: ctx.julyEntry.id,
                    }),
                ),
            ),
        ).rejects.toBeInstanceOf(AccountingPeriodClosedException);

        closed.reopen();
        await ctx.periodRepo.save(closed);

        await withRequestContext(() =>
            ctx.deleteHandler.execute(
                new DeleteWorkScheduleEntryCommand({
                    entryId: ctx.julyEntry.id,
                }),
            ),
        );
        expect(ctx.remove).toHaveBeenCalledTimes(1);
    });
});

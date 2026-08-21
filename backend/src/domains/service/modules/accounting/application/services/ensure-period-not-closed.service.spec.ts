import { EnsurePeriodNotClosedService } from './ensure-period-not-closed.service';
import { CreateEmployeeHoursEntryHandler } from '@/domains/service/modules/accounting/application/command/create-employee-hours-entry.handler';
import { CreateEmployeeHoursEntryCommand } from '@/domains/service/modules/accounting/application/command/create-employee-hours-entry.command';
import { UpdateEmployeeHoursEntryHandler } from '@/domains/service/modules/accounting/application/command/update-employee-hours-entry.handler';
import { UpdateEmployeeHoursEntryCommand } from '@/domains/service/modules/accounting/application/command/update-employee-hours-entry.command';
import { DeleteEmployeeHoursEntryHandler } from '@/domains/service/modules/accounting/application/command/delete-employee-hours-entry.handler';
import { DeleteEmployeeHoursEntryCommand } from '@/domains/service/modules/accounting/application/command/delete-employee-hours-entry.command';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { EmployeeHoursEntryRepositoryPort } from '@/domains/service/modules/accounting/application/ports/employee-hours-entry.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { EmployeeHoursEntry } from '@/domains/service/modules/accounting/domain/entities/employee-hours-entry.entity';
import { AccountingPeriodClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Блокировка часов закрытого месяца (PRD 1 docs/payroll-closing-and-accrual,
// "Блокировка графика работы и ручных часов"): единый сервис проверки,
// подключённый ко всем трём хендлерам EmployeeHoursEntry.
describe('EnsurePeriodNotClosedService — блокировка EmployeeHoursEntry', () => {
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

    const createHoursRepo = (entries: EmployeeHoursEntry[]) => {
        const byId = new Map(entries.map((entry) => [entry.id, entry]));
        const insert = jest.fn().mockResolvedValue(undefined);
        const update = jest.fn().mockResolvedValue(undefined);
        const remove = jest.fn().mockResolvedValue(undefined);
        const repo: EmployeeHoursEntryRepositoryPort = {
            insert,
            update,
            delete: remove,
            findById: (id) => Promise.resolve(byId.get(id) ?? null),
            findByEmployeeAndPeriod: jest.fn().mockResolvedValue(null),
            findByPeriod: jest.fn().mockResolvedValue(entries),
        };
        return { repo, insert, update, remove };
    };

    const setup = () => {
        const periods = createPeriodStore();
        const guard = new EnsurePeriodNotClosedService(periods.periodRepo);
        const julyEntry = EmployeeHoursEntry.create({
            employeeId: 42,
            period: '2026-07',
            hours: 160,
        });
        const juneEntry = EmployeeHoursEntry.create({
            employeeId: 42,
            period: '2026-06',
            hours: 150,
        });
        const hours = createHoursRepo([julyEntry, juneEntry]);
        return {
            ...periods,
            ...hours,
            guard,
            julyEntry,
            juneEntry,
            createHandler: new CreateEmployeeHoursEntryHandler(
                hours.repo,
                guard,
            ),
            updateHandler: new UpdateEmployeeHoursEntryHandler(
                hours.repo,
                guard,
            ),
            deleteHandler: new DeleteEmployeeHoursEntryHandler(
                hours.repo,
                guard,
            ),
        };
    };

    it('POST/PATCH/DELETE часов закрытого месяца → 409 AccountingPeriodClosedException с closedBy/closedAt', async () => {
        const ctx = setup();
        const closed = ctx.closePeriod('service', '2026-07', 7);

        const errors = await withRequestContext(() =>
            Promise.all([
                ctx.createHandler
                    .execute(
                        new CreateEmployeeHoursEntryCommand({
                            employeeId: 99,
                            period: '2026-07',
                            hours: 8,
                        }),
                    )
                    .catch((e: unknown) => e),
                ctx.updateHandler
                    .execute(
                        new UpdateEmployeeHoursEntryCommand({
                            entryId: ctx.julyEntry.id,
                            hours: 100,
                        }),
                    )
                    .catch((e: unknown) => e),
                ctx.deleteHandler
                    .execute(
                        new DeleteEmployeeHoursEntryCommand({
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

    it('часы другого (открытого) месяца редактируются, когда закрыт соседний', async () => {
        const ctx = setup();
        ctx.closePeriod('service', '2026-07');

        await withRequestContext(async () => {
            await ctx.createHandler.execute(
                new CreateEmployeeHoursEntryCommand({
                    employeeId: 99,
                    period: '2026-06',
                    hours: 8,
                }),
            );
            await ctx.updateHandler.execute(
                new UpdateEmployeeHoursEntryCommand({
                    entryId: ctx.juneEntry.id,
                    hours: 100,
                }),
            );
            await ctx.deleteHandler.execute(
                new DeleteEmployeeHoursEntryCommand({
                    entryId: ctx.juneEntry.id,
                }),
            );
        });

        expect(ctx.insert).toHaveBeenCalledTimes(1);
        expect(ctx.update).toHaveBeenCalledTimes(1);
        expect(ctx.remove).toHaveBeenCalledTimes(1);
    });

    it('часы — общий источник PayPerHour обоих направлений: закрытие месяца по shop тоже блокирует их', async () => {
        const ctx = setup();
        ctx.closePeriod('shop', '2026-07', 5);

        const error = await withRequestContext(() =>
            ctx.updateHandler
                .execute(
                    new UpdateEmployeeHoursEntryCommand({
                        entryId: ctx.julyEntry.id,
                        hours: 100,
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

    it('после reopen блокировка снимается — часы снова редактируются', async () => {
        const ctx = setup();
        const closed = ctx.closePeriod('service', '2026-07');

        await expect(
            withRequestContext(() =>
                ctx.updateHandler.execute(
                    new UpdateEmployeeHoursEntryCommand({
                        entryId: ctx.julyEntry.id,
                        hours: 100,
                    }),
                ),
            ),
        ).rejects.toBeInstanceOf(AccountingPeriodClosedException);

        closed.reopen();
        await ctx.periodRepo.save(closed);

        await withRequestContext(() =>
            ctx.updateHandler.execute(
                new UpdateEmployeeHoursEntryCommand({
                    entryId: ctx.julyEntry.id,
                    hours: 100,
                }),
            ),
        );
        expect(ctx.update).toHaveBeenCalledTimes(1);
    });
});

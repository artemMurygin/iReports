import { DirectionSyncLock } from './direction-sync-lock';
import { Period } from '@/shared/domain/period.value-object';

// Блокировка по направлению (PRD 1 docs/payroll-closing-and-accrual, Фаза
// 2): синк внутри закрытия периода и тик крона по одному направлению не
// выполняются параллельно — второй ждёт первого; разные направления друг
// другу не мешают.
describe('DirectionSyncLock', () => {
    const deferred = () => {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => {
            resolve = r;
        });
        return { promise, resolve };
    };

    it('две работы по одному направлению выполняются строго по очереди', async () => {
        const lock = new DirectionSyncLock();
        const events: string[] = [];
        const first = deferred();

        const a = lock.runExclusive('service', async () => {
            events.push('a:start');
            await first.promise;
            events.push('a:end');
        });
        const b = lock.runExclusive('service', async () => {
            events.push('b:start');
            await Promise.resolve();
            events.push('b:end');
        });

        await Promise.resolve();
        expect(events).toEqual(['a:start']);

        first.resolve();
        await Promise.all([a, b]);
        expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
        expect(lock.isLocked('service')).toBe(false);
    });

    it('ошибка первой работы не ломает очередь и не мешает второй', async () => {
        const lock = new DirectionSyncLock();

        await expect(
            lock.runExclusive('shop', () =>
                Promise.reject(new Error('ERP недоступна')),
            ),
        ).rejects.toThrow('ERP недоступна');
        await expect(
            lock.runExclusive('shop', () => Promise.resolve('ok')),
        ).resolves.toBe('ok');
    });

    it('разные направления не блокируют друг друга', async () => {
        const lock = new DirectionSyncLock();
        const events: string[] = [];
        const gate = deferred();

        const service = lock.runExclusive('service', async () => {
            events.push('service:start');
            await gate.promise;
        });
        const shop = lock.runExclusive('shop', async () => {
            events.push('shop:start');
            await Promise.resolve();
        });

        await shop;
        expect(events).toEqual(['service:start', 'shop:start']);
        gate.resolve();
        await service;
    });

    it('два независимых потребителя блокировки (крон-подобный тик и синк закрываемого периода) по одному направлению не идут параллельно', async () => {
        // Фейки нарочно не завязаны ни на одну конкретную ERP-интеграцию —
        // тест общего инфраструктурного примитива блокировки не должен
        // знать про RoApp/service. Форма повторяет реальных потребителей
        // (RoappSyncCron/RoappErpPeriodSyncAdapter, см.
        // domains/service/sync/roapp): оба вызывают
        // lock.runExclusive('service', ...) из независимых DI-компонентов.
        const lock = new DirectionSyncLock();
        const events: string[] = [];
        const cronGate = deferred();

        class FakeSyncCron {
            constructor(private readonly lock: DirectionSyncLock) {}

            async run(): Promise<void> {
                await this.lock.runExclusive('service', async () => {
                    events.push('cron:start');
                    await cronGate.promise;
                    events.push('cron:end');
                });
            }
        }

        const uploadClosedBetween = jest.fn(async (_from: Date, _to: Date) => {
            events.push('close:start');
            await Promise.resolve();
            events.push('close:end');
        });

        class FakePeriodSyncAdapter {
            constructor(private readonly lock: DirectionSyncLock) {}

            async syncPeriod(period: Period): Promise<void> {
                const { from, to } = period.getBounds();
                await this.lock.runExclusive('service', () =>
                    uploadClosedBetween(from, to),
                );
            }
        }

        const cron = new FakeSyncCron(lock);
        const adapter = new FakePeriodSyncAdapter(lock);

        const cronRun = cron.run();
        const closeRun = adapter.syncPeriod(Period.create('2026-07'));

        await Promise.resolve();
        expect(events).toEqual(['cron:start']);

        cronGate.resolve();
        await Promise.all([cronRun, closeRun]);
        expect(events).toEqual([
            'cron:start',
            'cron:end',
            'close:start',
            'close:end',
        ]);
        // Синк месяца — ровно границы закрываемого периода.
        const { from, to } = Period.create('2026-07').getBounds();
        expect(uploadClosedBetween).toHaveBeenCalledWith(from, to);
    });
});

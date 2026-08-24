import { EmployeeOperationLock } from './employee-operation-lock';

// Блокировка по сотруднику (PRD 3 docs/payroll-closing-and-accrual/
// prd-salary-payout-and-erp-cash-documents.md, «Технические ограничения»):
// две операции над одним сотрудником (выплата/удаление/ручное движение с
// erpSyncRequired) не выполняются параллельно — второй вызов ждёт
// завершения первого, а не отклоняется и не пропускается; разные сотрудники
// друг другу не мешают. Тот же контракт, что и у DirectionSyncLock (см.
// direction-sync-lock.spec.ts), но ключ — employeeId.
describe('EmployeeOperationLock', () => {
    const deferred = () => {
        let resolve!: () => void;
        const promise = new Promise<void>((r) => {
            resolve = r;
        });
        return { promise, resolve };
    };

    it('две операции над одним сотрудником выполняются строго по очереди', async () => {
        const lock = new EmployeeOperationLock();
        const events: string[] = [];
        const first = deferred();

        const a = lock.runExclusive(42, async () => {
            events.push('a:start');
            await first.promise;
            events.push('a:end');
        });
        const b = lock.runExclusive(42, async () => {
            events.push('b:start');
            await Promise.resolve();
            events.push('b:end');
        });

        await Promise.resolve();
        expect(events).toEqual(['a:start']);

        first.resolve();
        await Promise.all([a, b]);
        expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
        expect(lock.isLocked(42)).toBe(false);
    });

    it('ошибка первой операции не ломает очередь и не мешает второй', async () => {
        const lock = new EmployeeOperationLock();

        await expect(
            lock.runExclusive(42, () =>
                Promise.reject(new Error('ERP недоступна')),
            ),
        ).rejects.toThrow('ERP недоступна');
        await expect(
            lock.runExclusive(42, () => Promise.resolve('ok')),
        ).resolves.toBe('ok');
    });

    it('разные сотрудники не блокируют друг друга', async () => {
        const lock = new EmployeeOperationLock();
        const events: string[] = [];
        const gate = deferred();

        const first = lock.runExclusive(42, async () => {
            events.push('42:start');
            await gate.promise;
        });
        const second = lock.runExclusive(43, async () => {
            events.push('43:start');
            await Promise.resolve();
        });

        await second;
        expect(events).toEqual(['42:start', '43:start']);
        gate.resolve();
        await first;
    });
});

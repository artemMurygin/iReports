// Взаимное исключение по произвольному ключу — in-process очередь промисов,
// обобщённая версия механизма DirectionSyncLock (direction-sync-lock.ts,
// PRD 1 docs/payroll-closing-and-accrual, Фаза 2): второй вызов с тем же
// ключом ждёт завершения первого, а не пропускается и не отклоняется.
// Вынесена сюда в PRD 3 (Фаза 12,
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «Блокировка по сотруднику на время операции выплаты/удаления») — ключ там
// employeeId (number), а не AccountingDirection, поэтому понадобился
// generic-контейнер вместо специализированного под direction класса.
// DirectionSyncLock НЕ переписан поверх этого класса и оставлен как есть —
// он уже используется в RoappSyncModule/MoySkladSyncModule как класс с
// собственным DI-токеном (DirectionSyncLockModule), и у него ровно один
// потребитель конкретного типа ключа; заводить лишний уровень
// делегирования ради кода, который и так умещается в 20 строк, было бы
// избыточным рефакторингом ради рефакторинга — поведение существующих
// потребителей (erp-period-sync-runner.service.ts и др.) этот файл не
// трогает вообще.
export class KeyedLock<K> {
    private readonly tails = new Map<K, Promise<void>>();

    async runExclusive<T>(key: K, work: () => Promise<T>): Promise<T> {
        const previous = this.tails.get(key) ?? Promise.resolve();
        // Ошибка предыдущей работы — её проблема, очередь не ломает.
        const run = previous.then(() => work());
        const tail = run.then(
            () => undefined,
            () => undefined,
        );
        this.tails.set(key, tail);
        try {
            return await run;
        } finally {
            if (this.tails.get(key) === tail) {
                this.tails.delete(key);
            }
        }
    }

    isLocked(key: K): boolean {
        return this.tails.has(key);
    }
}

import { Injectable } from '@nestjs/common';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// Взаимное исключение синхронизаций ERP по направлению (PRD 1
// docs/payroll-closing-and-accrual, Фаза 2): тик крона (RoappSyncCron /
// MoySkladSyncCron) и неявный синк внутри закрытия периода не должны
// работать параллельно — оба пишут одни и те же таблицы заказов/отгрузок.
// Реализация — in-process очередь промисов на направление: второй вызов
// ждёт завершения первого, а не пропускается (крон, дождавшись закрытия,
// всё равно дотянет свой 5-минутный хвост; закрытие, дождавшись крона,
// получит актуальные данные). Один экземпляр на процесс — модуль
// DirectionSyncLockModule провайдит его один раз и экспортирует.
@Injectable()
export class DirectionSyncLock {
    private readonly tails = new Map<AccountingDirection, Promise<void>>();

    async runExclusive<T>(
        direction: AccountingDirection,
        work: () => Promise<T>,
    ): Promise<T> {
        const previous = this.tails.get(direction) ?? Promise.resolve();
        // Ошибка предыдущей работы — её проблема, очередь не ломает.
        const run = previous.then(() => work());
        const tail = run.then(
            () => undefined,
            () => undefined,
        );
        this.tails.set(direction, tail);
        try {
            return await run;
        } finally {
            if (this.tails.get(direction) === tail) {
                this.tails.delete(direction);
            }
        }
    }

    isLocked(direction: AccountingDirection): boolean {
        return this.tails.has(direction);
    }
}

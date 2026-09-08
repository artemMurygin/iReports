import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

export interface AccountingPeriodRepositoryPort {
    // null — для этой комбинации ещё нет записи, вызывающая сторона
    // трактует это как OPEN (см. AccountingPeriod, шапка комментария).
    findByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<AccountingPeriod | null>;

    // Upsert по (direction, period) — единственная точка записи, покрывает
    // и первое закрытие (записи ещё не было), и повторное открытие/закрытие
    // существующей.
    save(entity: AccountingPeriod): Promise<void>;
}

export const ACCOUNTING_PERIOD_REPOSITORY = Symbol(
    'ACCOUNTING_PERIOD_REPOSITORY',
);

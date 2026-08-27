import { BalanceTransaction } from '@/domains/service/modules/accounting/domain/entities/balance-transaction.entity';

// Порядок ленты движений баланса (Фаза 7 docs/employee-settlements-page-
// redesign): по убыванию даты движения (occurredAt), затем даты создания
// записи (createdAt), затем id — тройной ключ нужен для ПОЛНОЙ
// детерминированности курсорной пагинации. Без него у двух движений одного
// проведения строки (SALARY_ACCRUAL + ACCRUAL_ADJUSTMENT,
// BalanceTransaction.forAccruedLine) occurredAt общий (один вызов
// new Date() на оба движения в base), а createdAt у каждого выставляется
// отдельным вызовом Entity-конструктора — технически может совпасть до
// миллисекунды. Без третьего ключа порядок такой пары не определён: два
// подряд идущих запроса за одной и той же страницей могли бы вернуть их в
// разном порядке, а курсор (id последней записи страницы) — «потерять» или
// задвоить запись на границе страниц.
//
// Общая функция для Prisma-репозитория (orderBy) и in-memory тестового
// двойника (testing/in-memory-balance-transaction.repository.ts) — раньше
// они расходились (in-memory сортировал только по occurredAt, без createdAt
// и id вовсе), из-за чего тесты на in-memory-репозитории не ловили бы
// проблемы порядка, которые видны только на реальной БД, и наоборот.
export function compareBalanceTransactionsDesc(
    a: BalanceTransaction,
    b: BalanceTransaction,
): number {
    const occurredAtDiff = b.occurredAt.getTime() - a.occurredAt.getTime();
    if (occurredAtDiff !== 0) {
        return occurredAtDiff;
    }
    const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
    if (createdAtDiff !== 0) {
        return createdAtDiff;
    }
    if (a.id === b.id) {
        return 0;
    }
    // id DESC — та же строковая сортировка, что делает Postgres в
    // Prisma-репозитории (orderBy: [{ id: 'desc' }]) для UUID-строк.
    return a.id > b.id ? -1 : 1;
}

import { CalculationLine } from '@/shared/domain/calculation-line';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

export interface AccountingCalculationCacheEntry {
    freshnessStamp: string;
    factLines: CalculationLine[];
    prognoseLines: CalculationLine[];
    factTotal: number;
    prognoseTotal: number;
}

// Ленивый кэш результата расчёта (Фаза 6) по ключу
// (direction, period, employeeId) — сравнение freshnessStamp решает, отдать
// строку как есть или пересчитать и переписать её (см.
// domain/services/accounting-cache-freshness.ts).
export interface AccountingCalculationCachePort {
    find(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<AccountingCalculationCacheEntry | null>;

    upsert(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
        entry: AccountingCalculationCacheEntry,
    ): Promise<void>;

    // Ручное «пересчитать» (PRD: "руководитель нажимает «пересчитать» на
    // открытом периоде — кэш сбрасывается") и очистка при закрытии периода
    // (закрытый период больше не читает кэш — см.
    // GetEmployeeSalaryReportService — но оставлять устаревшие строки незачем).
    deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void>;
}

export const ACCOUNTING_CALCULATION_CACHE = Symbol(
    'ACCOUNTING_CALCULATION_CACHE',
);

import { RuleBreakdownLine } from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

export interface AccountingPeriodSnapshotRow {
    employeeId: number;
    total: number;
    lines: RuleBreakdownLine[];
}

// Неизменяемый снапшот сумм по каждому сотруднику за закрытый период (Фаза
// 6) — создаётся один раз при закрытии, отдаётся вместо расчёта всё время,
// пока период CLOSED, и удаляется целиком при повторном открытии.
export interface AccountingPeriodSnapshotPort {
    // periodId — id агрегата AccountingPeriod, которому принадлежит снапшот
    // (FK в БД, см. accounting-period.prisma); saveAll полностью заменяет
    // существующие строки периода, если они почему-то уже есть (повторное
    // закрытие после реоткрытия).
    saveAll(
        periodId: string,
        direction: AccountingDirection,
        period: string,
        rows: AccountingPeriodSnapshotRow[],
    ): Promise<void>;

    findByKey(
        direction: AccountingDirection,
        period: string,
        employeeId: number,
    ): Promise<AccountingPeriodSnapshotRow | null>;

    deleteByDirectionAndPeriod(
        direction: AccountingDirection,
        period: string,
    ): Promise<void>;
}

export const ACCOUNTING_PERIOD_SNAPSHOT = Symbol('ACCOUNTING_PERIOD_SNAPSHOT');

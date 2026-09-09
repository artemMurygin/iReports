import { ConflictException } from '@/shared/exceptions';

// Раздел 9 tasks.md (add-task-based-salary-rule): защита от задвоения задачи
// Bitrix24 на (salaryRuleId, period) — уникальный индекс
// @@unique([salaryRuleId, period]) в Prisma-модели SalaryTask (задача 1.1,
// design.md Decision 1/4 — «последний рубеж защиты от гонки» для
// EnsureSalaryTaskForPeriodService.ensure(), раздел 11). P2002 мапится в
// это доменное исключение тем же приёмом, что
// PayoutCashboxRecordAlreadyExistsException у PayoutCashboxRecordRepository
// (erp-cash.exception.ts) — а не остаётся сырым
// Prisma.PrismaClientKnownRequestError. Брошено SalaryTaskRepository
// (service); у shop с раздела 14 собственный независимый аналог в
// domains/shop/modules/accounting/domain/exceptions/.
export class SalaryTaskAlreadyExistsException extends ConflictException {
    constructor(salaryRuleId: string, period: string) {
        super(
            `Задача Bitrix24 для зарплатного правила ${salaryRuleId} за период ` +
                `${period} уже создана — повторное создание отклонено уникальным ` +
                'индексом (salaryRuleId, period)',
        );
    }
}

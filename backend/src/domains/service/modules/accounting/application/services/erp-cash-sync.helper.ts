import type {
    BalanceTransactionType,
    ExternalSystem,
} from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';

// Общие мелочи синхронизации ручного движения с кассой ERP (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// Фаза 12) — вынесены из CreateBalanceTransactionHandler в отдельный файл,
// чтобы обработчик выплаты (следующие агенты Фазы 12) мог переиспользовать
// ровно то же построение system/purpose, не копируя его.

// Система ERP направления — Prisma ExternalSystem (contracts/commands/
// employee-identity.ts), та же связка, что EmployeeIdentity.system: у
// service всегда ROAPP, у shop всегда MOY_SKLAD (PRD 3, «Критерии
// готовности»: «для service документ никогда не уходит в МойСклад и
// наоборот»).
export function erpSystemForDirection(
    direction: AccountingDirection,
): ExternalSystem {
    return direction === 'service' ? 'ROAPP' : 'MOY_SKLAD';
}

// Русские названия типа движения — зеркало transactionTypeLabel
// (frontend/src/features/EmployeeBalance/model/transactionLabels.ts):
// бэкенд и фронтенд не делят код, но пользователь должен видеть одинаковый
// текст что в ленте баланса iReports, что в description кассового
// документа ERP.
const BALANCE_TRANSACTION_TYPE_LABEL: Record<BalanceTransactionType, string> = {
    SALARY_ACCRUAL: 'Начисление',
    ACCRUAL_ADJUSTMENT: 'Корректировка начисления',
    ADVANCE: 'Аванс',
    EXTRA_ADVANCE: 'Доп. аванс',
    BONUS: 'Премия',
    SICK_LEAVE: 'Больничный',
    VACATION_PAY: 'Отпускные',
    PENALTY: 'Штраф',
    ADJUSTMENT: 'Корректировка вручную',
    PAYOUT: 'Выплата',
};

// Назначение документа ERP (PRD 3, «В скоупе»: «Назначение документа ERP
// содержит период и тип движения... + ФИО сотрудника», «Критерии
// готовности»: «Назначение документа ERP содержит тип движения и период»)
// — период присутствует, только если у движения он есть (ручные движения
// PRD 2 не обязаны ссылаться на период, см. createBalanceTransactionRequestSchema);
// ФИО — best-effort: у RemOnline нет отдельного поля для сотрудника-агента
// транзакции (см. WHY в erp-cash-document.port.ts службы) — без имени в
// тексте бухгалтер не смог бы понять, о ком документ, поэтому имя
// добавляется, когда справочник смог его разрешить, а не блокирует
// операцию, если почему-то не смог (см. resolveEmployeeDisplayName).
export function buildErpCashDocumentPurpose(
    type: BalanceTransactionType,
    period: string | undefined,
    employeeName: string | null,
): string {
    const label = BALANCE_TRANSACTION_TYPE_LABEL[type];
    const withPeriod = period ? `${label} за ${period}` : label;
    return employeeName ? `${withPeriod} — ${employeeName}` : withPeriod;
}

// Резолв ФИО сотрудника из справочника Bitrix — best-effort (см. WHY у
// buildErpCashDocumentPurpose): DirectoryRepositoryPort не даёт lookup по
// одному id (только findEmployees() целиком, см. directory.port.ts), но это
// единственный источник имени, который у обработчика вообще есть, а вызов
// нечастый (одно ручное движение — один запрос, не N+1 в цикле).
export async function resolveEmployeeDisplayName(
    directoryRepo: DirectoryRepositoryPort,
    employeeId: number,
): Promise<string | null> {
    const employees = await directoryRepo.findEmployees();
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
        return null;
    }
    return `${employee.lastName} ${employee.firstName}`.trim();
}

import { Injectable } from '@nestjs/common';
import { KeyedLock } from './keyed-lock';

// Блокировка по сотруднику на время операции выплаты/удаления (PRD 3
// docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md,
// «Технические ограничения»: «чтобы два руководителя не провели две
// операции одновременно» — и «Критерии готовности»: «Две параллельные
// выплаты одному сотруднику не создают задвоенный документ ERP»). Ключ —
// employeeId, не пара (direction, employeeId): баланс сотрудника общий
// (PRD 2) — выплата в одном направлении и, например, удаление ручного
// движения с документом ERP в другом обе читают/пишут одну и ту же ленту
// баланса того же сотрудника, поэтому сериализуются вместе, а не только
// операции внутри одного направления.
//
// Один экземпляр на процесс — как DirectionSyncLock/DirectionSyncLockModule,
// но отдельный класс, а не рефакторинг DirectionSyncLock поверх KeyedLock:
// см. WHY в keyed-lock.ts.
@Injectable()
export class EmployeeOperationLock {
    private readonly lock = new KeyedLock<number>();

    async runExclusive<T>(
        employeeId: number,
        work: () => Promise<T>,
    ): Promise<T> {
        return this.lock.runExclusive(employeeId, work);
    }

    isLocked(employeeId: number): boolean {
        return this.lock.isLocked(employeeId);
    }
}

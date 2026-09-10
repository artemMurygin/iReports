import { Inject, Injectable } from '@nestjs/common';
import type { SalaryAccrualLineSummary } from 'ireports-contracts';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — зеркало
// domains/service/.../find-salary-accrual-for-task.service.ts, без
// параметра direction (см. WHY на ShopSalaryAccrualRepositoryPort). spec:
// shop/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
@Injectable()
export class FindSalaryAccrualForTaskService {
    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly salaryAccrualRepo: ShopSalaryAccrualRepositoryPort,
    ) {}

    async execute(taskId: string): Promise<SalaryAccrualLineSummary | null> {
        const line = await this.salaryAccrualRepo.findLineByTaskId(taskId);
        if (!line) {
            return null;
        }
        return {
            id: line.id,
            amount: line.amount,
            status: line.status,
        };
    }
}

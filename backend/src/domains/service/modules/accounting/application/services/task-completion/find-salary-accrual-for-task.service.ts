import { Inject, Injectable } from '@nestjs/common';
import type { SalaryAccrualLineSummary } from 'ireports-contracts';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';

// Раздел 17 tasks.md (add-task-salary-rule-links-comments) — зеркало
// FindSalaryRuleForTaskService для начисления за задачу. direction
// зафиксирован 'service': сервис этого домена всегда ищет строки в
// документах своего направления (SalaryAccrualRepositoryPort
// direction-агностичен, direction — явный параметр метода, см. WHY на
// порте). spec:
// service/accounting#requirement-зарплатное-правило-и-начисление-доступны-для-поиска-по-идентификатору-задачи
@Injectable()
export class FindSalaryAccrualForTaskService {
    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly salaryAccrualRepo: SalaryAccrualRepositoryPort,
    ) {}

    async execute(taskId: string): Promise<SalaryAccrualLineSummary | null> {
        const line = await this.salaryAccrualRepo.findLineByTaskId(
            'service',
            taskId,
        );
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

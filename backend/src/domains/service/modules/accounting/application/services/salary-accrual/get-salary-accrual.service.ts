import { Inject, Injectable } from '@nestjs/common';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { SalaryAccrualNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { SalaryAccrualMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { resolveEmployees } from './list-salary-accruals.service';

// Карточка документа начисления (GET .../salary_accruals/:id) — generic по
// direction, как ListSalaryAccrualsService. Документ другого направления
// под этим путём не существует (404): /v1/service/... не отдаёт документы
// shop и наоборот — тот же принцип раздельных маршрутов, что и у остальных
// эндпоинтов accounting.
@Injectable()
export class GetSalaryAccrualService {
    private readonly mapper = new SalaryAccrualMapper();

    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(
        direction: AccountingDirection,
        id: string,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(id);
        if (!accrual || accrual.direction !== direction) {
            throw new SalaryAccrualNotFoundException(direction, id);
        }
        const employees = await resolveEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

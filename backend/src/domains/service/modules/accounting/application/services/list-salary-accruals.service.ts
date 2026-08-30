import { Inject, Injectable } from '@nestjs/common';
import type { SalaryAccrualListResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import {
    SalaryAccrualEmployeeInfo,
    SalaryAccrualMapper,
} from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';

// Список документов начисления за период (PRD 1
// docs/payroll-closing-and-accrual, GET .../salary_accruals?period) —
// generic по direction, как GetAccountingPeriodService: контроллеры обоих
// доменов подставляют своё направление сами, ShopAccountingModule заводит
// собственный экземпляр этого класса. Открытый период (документов ещё нет)
// — пустой список, не ошибка: фронтенд показывает empty-state «месяц ещё не
// закрыт».
@Injectable()
export class ListSalaryAccrualsService {
    private readonly mapper = new SalaryAccrualMapper();

    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(
        direction: AccountingDirection,
        period: string,
    ): Promise<SalaryAccrualListResponse> {
        const periodValue = Period.create(period).getValue();
        const accruals = await this.accrualRepo.findByDirectionAndPeriod(
            direction,
            periodValue,
        );
        const employees = await resolveEmployees(this.directoryRepo);
        const items = accruals.map((accrual) =>
            this.mapper.toListItemResponse(
                accrual,
                employees.get(accrual.employeeId) ??
                    SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
            ),
        );
        return {
            direction,
            period: periodValue,
            items,
            total: items.reduce((sum, item) => sum + item.total, 0),
        };
    }
}

// Один запрос к справочнику на весь список, а не по сотруднику (нет N+1).
export async function resolveEmployees(
    directoryRepo: DirectoryRepositoryPort,
): Promise<Map<number, SalaryAccrualEmployeeInfo>> {
    const employees = await directoryRepo.findEmployees();
    return new Map(
        employees.map((employee) => [
            employee.id,
            {
                name: `${employee.firstName} ${employee.lastName}`,
                departmentId: employee.departmentId,
            },
        ]),
    );
}

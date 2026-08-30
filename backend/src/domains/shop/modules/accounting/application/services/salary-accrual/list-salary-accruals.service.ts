import { Inject, Injectable } from '@nestjs/common';
import type { SalaryAccrualListResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import {
    ShopSalaryAccrualEmployeeInfo,
    ShopSalaryAccrualMapper,
} from '@/domains/shop/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';

// Зеркало domains/service/modules/accounting/application/services/
// list-salary-accruals.service.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Открытый период (документов ещё
// нет) — пустой список, не ошибка.
@Injectable()
export class ListShopSalaryAccrualsService {
    private readonly mapper = new ShopSalaryAccrualMapper();

    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(period: string): Promise<SalaryAccrualListResponse> {
        const periodValue = Period.create(period).getValue();
        const accruals = await this.accrualRepo.findByPeriod(periodValue);
        const employees = await resolveShopEmployees(this.directoryRepo);
        const items = accruals.map((accrual) =>
            this.mapper.toListItemResponse(
                accrual,
                employees.get(accrual.employeeId) ??
                    ShopSalaryAccrualMapper.unknownEmployeeInfo(
                        accrual.employeeId,
                    ),
            ),
        );
        return {
            direction: 'shop',
            period: periodValue,
            items,
            total: items.reduce((sum, item) => sum + item.total, 0),
        };
    }
}

// Один запрос к справочнику на весь список, а не по сотруднику (нет N+1).
export async function resolveShopEmployees(
    directoryRepo: DirectoryRepositoryPort,
): Promise<Map<number, ShopSalaryAccrualEmployeeInfo>> {
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

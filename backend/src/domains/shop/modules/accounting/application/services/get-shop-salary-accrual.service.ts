import { Inject, Injectable } from '@nestjs/common';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { ShopSalaryAccrualNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-salary-accrual.exception';
import {
    toShopSalaryAccrualResponse,
    unknownShopEmployeeInfo,
} from '../mappers/to-shop-salary-accrual-response';
import { resolveShopEmployees } from './list-shop-salary-accruals.service';

// Зеркало domains/service/modules/accounting/application/services/
// get-salary-accrual.service.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимая копия для направления shop. Документ, найденный по id, но не
// направления shop, здесь произойти не может: findById репозитория уже
// фильтрует по direction: 'shop' (см. ShopSalaryAccrualRepository).
@Injectable()
export class GetShopSalaryAccrualService {
    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(id: string): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(id);
        if (!accrual) {
            throw new ShopSalaryAccrualNotFoundException(id);
        }
        const employees = await resolveShopEmployees(this.directoryRepo);
        return toShopSalaryAccrualResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                unknownShopEmployeeInfo(accrual.employeeId),
        );
    }
}

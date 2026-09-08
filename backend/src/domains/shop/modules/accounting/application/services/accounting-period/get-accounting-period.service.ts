import { Inject, Injectable } from '@nestjs/common';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ShopAccountingPeriodMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/accounting-period/accounting-period.mapper';

// Зеркало domains/service/modules/accounting/application/services/
// get-accounting-period.service.ts (Фаза 5
// docs/service-shop-boundary-violations-fix) — независимая копия для
// направления shop.
@Injectable()
export class GetShopAccountingPeriodService {
    private readonly mapper = new ShopAccountingPeriodMapper();

    constructor(
        @Inject(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: ShopAccountingPeriodRepositoryPort,
    ) {}

    async execute(period: string): Promise<AccountingPeriodResponse> {
        const validatedPeriod = Period.create(period);
        const entity = await this.periodRepo.findByPeriod(
            validatedPeriod.getValue(),
        );
        return this.mapper.toResponse(entity, validatedPeriod.getValue());
    }
}

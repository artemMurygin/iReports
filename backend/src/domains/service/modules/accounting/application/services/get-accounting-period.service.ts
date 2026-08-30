import { Inject, Injectable } from '@nestjs/common';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { AccountingPeriodMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/accounting-period/accounting-period.mapper';

@Injectable()
export class GetAccountingPeriodService {
    private readonly mapper = new AccountingPeriodMapper();

    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
    ) {}

    async execute(
        direction: AccountingDirection,
        period: string,
    ): Promise<AccountingPeriodResponse> {
        const validatedPeriod = Period.create(period);
        const entity = await this.periodRepo.findByDirectionAndPeriod(
            direction,
            validatedPeriod.getValue(),
        );
        return this.mapper.toResponse(
            entity,
            direction,
            validatedPeriod.getValue(),
        );
    }
}

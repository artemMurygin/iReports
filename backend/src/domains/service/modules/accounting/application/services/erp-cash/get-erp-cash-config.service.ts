import { Inject, Injectable } from '@nestjs/common';
import type { ErpCashConfigResponse } from 'ireports-contracts';
import { ERP_CASH_CONFIG_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-config.port';
import type { ErpCashConfigRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-config.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { ErpCashConfigMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/erp-cash/erp-cash-config.mapper';

// Generic по direction — как GetAccountingPeriodService: физически один
// класс, свой экземпляр провайдера в AccountingModule сервиса и в
// ShopAccountingModule (см. domains/service/CLAUDE.md).
@Injectable()
export class GetErpCashConfigService {
    private readonly mapper = new ErpCashConfigMapper();

    constructor(
        @Inject(ERP_CASH_CONFIG_REPOSITORY)
        private readonly repo: ErpCashConfigRepositoryPort,
    ) {}

    async execute(
        direction: AccountingDirection,
    ): Promise<ErpCashConfigResponse> {
        const config = await this.repo.findByDirection(direction);
        return this.mapper.toResponse(config, direction);
    }
}

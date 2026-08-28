import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Period } from '@/shared/domain/period.value-object';
import { ShopPeriodAlreadyClosedException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-accounting-period.exception';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period.port';
import { SHOP_ACCOUNTING_CALCULATION_CACHE } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-calculation-cache.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-calculation-cache.port';
import { RecalculateShopAccountingPeriodCommand } from './recalculate-shop-accounting-period.command';

// Зеркало domains/service/modules/accounting/application/command/
// recalculate-accounting-period.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop, выделенный из generic по
// direction RecalculateAccountingPeriodHandler сервиса: собственные
// SHOP_ACCOUNTING_PERIOD_REPOSITORY/SHOP_ACCOUNTING_CALCULATION_CACHE.
// Пересчёт ленивый (см. WHY у сервисного хендлера) — этот хендлер лишь
// сбрасывает кэш периода.
@CommandHandler(RecalculateShopAccountingPeriodCommand)
export class RecalculateShopAccountingPeriodHandler implements ICommandHandler<
    RecalculateShopAccountingPeriodCommand,
    void
> {
    constructor(
        @Inject(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: ShopAccountingPeriodRepositoryPort,
        @Inject(SHOP_ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: ShopAccountingCalculationCachePort,
    ) {}

    async execute(
        command: RecalculateShopAccountingPeriodCommand,
    ): Promise<void> {
        const period = Period.create(command.period);

        const periodEntity = await this.periodRepo.findByPeriod(
            period.getValue(),
        );
        if (periodEntity?.isClosed()) {
            throw new ShopPeriodAlreadyClosedException(period.getValue());
        }

        await this.cacheRepo.deleteByPeriod(period.getValue());
    }
}

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { ShopPeriodNotClosedException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-accounting-period.exception';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period.port';
import { SHOP_ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period-snapshot.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/shop-accounting-period-snapshot.port';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-accrual.port';
import { ShopSalaryAccrualsNotDraftException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-salary-accrual.exception';
import { toShopAccountingPeriodResponse } from '../mappers/to-shop-accounting-period-response';
import { ReopenShopAccountingPeriodCommand } from './reopen-shop-accounting-period.command';

// Зеркало domains/service/modules/accounting/application/command/
// reopen-accounting-period.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop, выделенный из generic по
// direction ReopenAccountingPeriodHandler сервиса (см. WHY, ранее
// зафиксированный в shop-accounting.module.ts): собственные
// SHOP_ACCOUNTING_PERIOD_REPOSITORY/SHOP_ACCOUNTING_PERIOD_SNAPSHOT/
// SHOP_SALARY_ACCRUAL_REPOSITORY вместо сервисных generic-по-direction
// токенов.
@CommandHandler(ReopenShopAccountingPeriodCommand)
export class ReopenShopAccountingPeriodHandler implements ICommandHandler<
    ReopenShopAccountingPeriodCommand,
    AccountingPeriodResponse
> {
    constructor(
        @Inject(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: ShopAccountingPeriodRepositoryPort,
        @Inject(SHOP_ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: ShopAccountingPeriodSnapshotPort,
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(
        command: ReopenShopAccountingPeriodCommand,
    ): Promise<AccountingPeriodResponse> {
        const period = Period.create(command.period);

        const periodEntity = await this.periodRepo.findByPeriod(
            period.getValue(),
        );
        if (!periodEntity || periodEntity.isOpen()) {
            throw new ShopPeriodNotClosedException(period.getValue());
        }

        const accruals = await this.accrualRepo.findByPeriod(period.getValue());
        const notDraft = accruals.filter((accrual) => !accrual.isDraft());
        if (notDraft.length > 0) {
            throw new ShopSalaryAccrualsNotDraftException(
                period.getValue(),
                notDraft.map((accrual) => ({
                    id: accrual.id,
                    employeeId: accrual.employeeId,
                    status: accrual.status,
                })),
            );
        }

        periodEntity.reopen();

        await this.unitOfWork.run(async () => {
            await this.periodRepo.save(periodEntity);
            await this.accrualRepo.deleteByPeriod(period.getValue());
            await this.snapshotRepo.deleteByPeriod(period.getValue());
        });

        return toShopAccountingPeriodResponse(periodEntity, period.getValue());
    }
}

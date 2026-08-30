import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type {
    AccruePeriodSalaryAccrualsResponse,
    SalaryAccrualLineFailure,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { resolveShopEmployees } from '../../services/salary-accrual/list-salary-accruals.service';
import { accrueShopDraftLines } from './accrue-draft-lines.helper';
import { AccruePeriodShopSalaryAccrualsCommand } from './accrue-period-salary-accruals.command';

// Зеркало domains/service/modules/accounting/application/command/
// accrue-period-salary-accruals.handler.ts (Фаза 6 docs/service-shop-boundary-violations-fix)
// — независимый хендлер для направления shop.
@CommandHandler(AccruePeriodShopSalaryAccrualsCommand)
export class AccruePeriodShopSalaryAccrualsHandler implements ICommandHandler<
    AccruePeriodShopSalaryAccrualsCommand,
    AccruePeriodSalaryAccrualsResponse
> {
    constructor(
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: AccruePeriodShopSalaryAccrualsCommand,
    ): Promise<AccruePeriodSalaryAccrualsResponse> {
        const period = Period.create(command.period).getValue();
        const accruals = await this.accrualRepo.findByPeriod(period);
        const employees = await resolveShopEmployees(this.directoryRepo);

        let accruedLinesCount = 0;
        let accruedAmount = 0;
        const failures: SalaryAccrualLineFailure[] = [];
        for (const accrual of accruals) {
            if (accrual.isPaid()) {
                continue;
            }
            const result = await accrueShopDraftLines(
                this.commandBus,
                accrual,
                command.accruedBy,
                employees,
            );
            accruedLinesCount += result.accruedLinesCount;
            accruedAmount += result.accruedAmount;
            failures.push(...result.failures);
        }

        const updated = await this.accrualRepo.findByPeriod(period);
        return {
            direction: 'shop',
            period,
            documentsCount: updated.length,
            accruedDocumentsCount: updated.filter(
                (accrual) =>
                    accrual.status === 'ACCRUED' || accrual.status === 'PAID',
            ).length,
            accruedLinesCount,
            accruedAmount,
            failures,
        };
    }
}

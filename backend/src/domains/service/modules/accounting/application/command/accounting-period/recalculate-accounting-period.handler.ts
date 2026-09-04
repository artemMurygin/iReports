import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Period } from '@/shared/domain/period.value-object';
import { PeriodAlreadyClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { RecalculateAccountingPeriodCommand } from './recalculate-accounting-period.command';

// Ручное «пересчитать» для руководителя (PRD: "Руководитель нажимает
// «пересчитать» на открытом периоде → кэш сбрасывается и расчёт выполняется
// заново по актуальным данным"). Сам пересчёт — ленивый: этот хендлер лишь
// сбрасывает кэш периода, следующий запрос отчёта видит промах кэша и
// пересчитывает (см. GetEmployeeSalaryReportService) — синхронного массового
// пересчёта всех сотрудников здесь нет, он не нужен раньше, чем кто-то
// реально откроет отчёт.
@CommandHandler(RecalculateAccountingPeriodCommand)
export class RecalculateAccountingPeriodHandler implements ICommandHandler<
    RecalculateAccountingPeriodCommand,
    void
> {
    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
        @Inject(ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: AccountingCalculationCachePort,
    ) {}

    async execute(command: RecalculateAccountingPeriodCommand): Promise<void> {
        const period = Period.create(command.period);

        const periodEntity = await this.periodRepo.findByDirectionAndPeriod(
            command.direction,
            period.getValue(),
        );
        if (periodEntity?.isClosed()) {
            throw new PeriodAlreadyClosedException(
                command.direction,
                period.getValue(),
            );
        }

        await this.cacheRepo.deleteByDirectionAndPeriod(
            command.direction,
            period.getValue(),
        );
    }
}

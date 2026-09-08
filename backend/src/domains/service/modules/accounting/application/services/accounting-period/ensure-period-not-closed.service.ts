import { Inject, Injectable } from '@nestjs/common';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { AccountingPeriodClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';

const ALL_DIRECTIONS: readonly AccountingDirection[] = ['service', 'shop'];

// Единая точка проверки "месяц закрыт" для любых источников часов (PRD 1
// docs/payroll-closing-and-accrual, "Блокировка графика работы и ручных
// часов"): сейчас — EmployeeHoursEntry (Create/Update/Delete-хендлеры),
// позже — график работы/переработки из docs/employee-work-schedule, который
// подключает этот же сервис, а не дублирует проверку.
//
// По умолчанию проверяются ОБА направления: EmployeeHoursEntry не привязана
// к направлению и питает PayPerHour и сервиса, и магазина, поэтому закрытый
// по любому направлению месяц фиксирует часы — иначе часы разойдутся со
// снапшотом того направления, которое уже закрыто (PRD 1: "блокировка
// распространяется на все источники часов, из которых считает PayPerHour").
// Источник, привязанный к одному направлению, передаёт его явно.
@Injectable()
export class EnsurePeriodNotClosedService {
    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
    ) {}

    async ensureNotClosed(
        period: string,
        directions: readonly AccountingDirection[] = ALL_DIRECTIONS,
    ): Promise<void> {
        for (const direction of directions) {
            const entity = await this.periodRepo.findByDirectionAndPeriod(
                direction,
                period,
            );
            if (entity?.isClosed()) {
                throw new AccountingPeriodClosedException(
                    direction,
                    period,
                    entity.closedBy,
                    entity.closedAt,
                );
            }
        }
    }
}

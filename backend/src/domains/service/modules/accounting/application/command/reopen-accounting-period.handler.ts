import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { PeriodNotClosedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { SalaryAccrualsNotDraftException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { AccountingPeriodMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/accounting-period/accounting-period.mapper';
import { ReopenAccountingPeriodCommand } from './reopen-accounting-period.command';

// Повторное открытие закрытого периода — только с явным подтверждением
// (проверено на границе HTTP, см. ReopenAccountingPeriodCommand) и с
// удалением снапшота целиком (см. PRD: "повторное открытие — только
// руководителем, с явным подтверждением и удалением снапшота").
//
// PRD 1 docs/payroll-closing-and-accrual: вместе со снапшотом закрытие
// породило документы начисления — переоткрытие удаляет и их, но только пока
// все они в DRAFT; документ, уже проведённый на баланс (PRD 2), делает
// переоткрытие невозможным — 409 с перечнем таких документов, ничего не
// удаляется. Проверка идёт через порт SalaryAccrualRepositoryPort — хендлер
// generic по direction и обслуживает оба домена (см. accounting.module.ts).
@CommandHandler(ReopenAccountingPeriodCommand)
export class ReopenAccountingPeriodHandler implements ICommandHandler<
    ReopenAccountingPeriodCommand,
    AccountingPeriodResponse
> {
    private readonly mapper = new AccountingPeriodMapper();

    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
        @Inject(ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: AccountingPeriodSnapshotPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(
        command: ReopenAccountingPeriodCommand,
    ): Promise<AccountingPeriodResponse> {
        const period = Period.create(command.period);

        const periodEntity = await this.periodRepo.findByDirectionAndPeriod(
            command.direction,
            period.getValue(),
        );
        if (!periodEntity || periodEntity.isOpen()) {
            throw new PeriodNotClosedException(
                command.direction,
                period.getValue(),
            );
        }

        const accruals = await this.accrualRepo.findByDirectionAndPeriod(
            command.direction,
            period.getValue(),
        );
        const notDraft = accruals.filter((accrual) => !accrual.isDraft());
        if (notDraft.length > 0) {
            throw new SalaryAccrualsNotDraftException(
                command.direction,
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
            await this.accrualRepo.deleteByDirectionAndPeriod(
                command.direction,
                period.getValue(),
            );
            await this.snapshotRepo.deleteByDirectionAndPeriod(
                command.direction,
                period.getValue(),
            );
        });

        return this.mapper.toResponse(
            periodEntity,
            command.direction,
            period.getValue(),
        );
    }
}

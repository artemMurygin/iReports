import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type {
    AccruePeriodSalaryAccrualsResponse,
    SalaryAccrualLineFailure,
} from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { resolveEmployees } from '../services/list-salary-accruals.service';
import { accrueDraftLines } from './accrue-draft-lines.helper';
import { AccruePeriodSalaryAccrualsCommand } from './accrue-period-salary-accruals.command';

// «Начислить все документы месяца» (PRD 2, Фаза 7): все документы
// направления за период проводятся построчно, каждая строка — в своей
// транзакции (см. accrueDraftLines); результат — статистика для модалки
// P2.1 («Начислено N из M документов на X ₽») и перечень ошибок с ФИО и
// правилом. Выплаченные документы (PAID) пропускаются: у них нет
// DRAFT-строк, а действия над ними запрещены. Открытый период (документов
// нет) — нулевая статистика, не ошибка.
@CommandHandler(AccruePeriodSalaryAccrualsCommand)
export class AccruePeriodSalaryAccrualsHandler implements ICommandHandler<
    AccruePeriodSalaryAccrualsCommand,
    AccruePeriodSalaryAccrualsResponse
> {
    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: AccruePeriodSalaryAccrualsCommand,
    ): Promise<AccruePeriodSalaryAccrualsResponse> {
        const period = Period.create(command.period).getValue();
        const accruals = await this.accrualRepo.findByDirectionAndPeriod(
            command.direction,
            period,
        );
        const employees = await resolveEmployees(this.directoryRepo);

        let accruedLinesCount = 0;
        let accruedAmount = 0;
        const failures: SalaryAccrualLineFailure[] = [];
        for (const accrual of accruals) {
            if (accrual.isPaid()) {
                continue;
            }
            const result = await accrueDraftLines(
                this.commandBus,
                accrual,
                command.accruedBy,
                employees,
            );
            accruedLinesCount += result.accruedLinesCount;
            accruedAmount += result.accruedAmount;
            failures.push(...result.failures);
        }

        // Число полностью проведённых документов считается по перечитанному
        // состоянию: построчные транзакции меняли документы независимо.
        const updated = await this.accrualRepo.findByDirectionAndPeriod(
            command.direction,
            period,
        );
        return {
            direction: command.direction,
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

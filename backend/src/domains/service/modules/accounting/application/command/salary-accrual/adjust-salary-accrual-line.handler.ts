import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { SalaryAccrualNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { SalaryAccrualMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { resolveEmployees } from '../../services/salary-accrual/list-salary-accruals.service';
import { AdjustSalaryAccrualLineCommand } from './adjust-salary-accrual-line.command';

// Корректировка строки документа начисления (PRD 2 docs/payroll-closing-
// and-accrual, Фаза 6): руководитель не согласен с суммой расчёта — меняет
// действующую сумму строки (amount) с обязательным комментарием до
// проведения. originalAmount не меняется (след исходного расчёта остаётся
// виден рядом), история корректировок хранится целиком
// (SalaryAccrualLineAdjustment). Движений на балансе корректировка сама по
// себе не создаёт — разница ляжет движением ACCRUAL_ADJUSTMENT при
// проведении строки (см. AccrueSalaryAccrualLineHandler).
//
// Только для строки в DRAFT (проведённая — 409, сначала «Отменить
// начисление»); комментарий обязателен и на границе HTTP
// (adjustSalaryAccrualLineRequestSchema), и в домене
// (SalaryAccrualLineAdjustment.validate) — 400 без него.
@CommandHandler(AdjustSalaryAccrualLineCommand)
export class AdjustSalaryAccrualLineHandler implements ICommandHandler<
    AdjustSalaryAccrualLineCommand,
    SalaryAccrualResponse
> {
    private readonly mapper = new SalaryAccrualMapper();

    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
    ) {}

    async execute(
        command: AdjustSalaryAccrualLineCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual || accrual.direction !== command.direction) {
            throw new SalaryAccrualNotFoundException(
                command.direction,
                command.accrualId,
            );
        }

        accrual.adjustLine(
            command.lineId,
            command.amount,
            command.comment,
            command.adjustedBy,
        );

        // Один агрегат — транзакцию открывает сам репозиторий
        // (PrismaRepository.write), отдельный UnitOfWork не нужен.
        await this.accrualRepo.save(accrual);

        const employees = await resolveEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

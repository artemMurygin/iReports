import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccrueSalaryAccrualDocumentResponse } from 'ireports-contracts';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import {
    SalaryAccrualNotFoundException,
    SalaryAccrualPaidException,
} from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { SalaryAccrualMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { resolveEmployees } from '../services/list-salary-accruals.service';
import { accrueDraftLines } from './accrue-draft-lines.helper';
import { AccrueSalaryAccrualDocumentCommand } from './accrue-salary-accrual-document.command';

// «Начислить всё» по документу (PRD 2, Фаза 7): все непроведённые строки
// проводятся построчно — каждая в своей транзакции через диспатч
// AccrueSalaryAccrualLineCommand (см. accrueDraftLines): сбой одной строки
// не откатывает остальные, но и не остаётся незамеченным — ответ несёт
// перечень неудачных строк рядом с обновлённой карточкой. Полностью
// проведённый документ — no-op с пустым перечнем (повторный вызов
// идемпотентен на уровне операции), выплаченный (PAID) — 409: действия над
// строками выплаченного документа запрещены целиком.
@CommandHandler(AccrueSalaryAccrualDocumentCommand)
export class AccrueSalaryAccrualDocumentHandler implements ICommandHandler<
    AccrueSalaryAccrualDocumentCommand,
    AccrueSalaryAccrualDocumentResponse
> {
    private readonly mapper = new SalaryAccrualMapper();

    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        private readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: AccrueSalaryAccrualDocumentCommand,
    ): Promise<AccrueSalaryAccrualDocumentResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual || accrual.direction !== command.direction) {
            throw new SalaryAccrualNotFoundException(
                command.direction,
                command.accrualId,
            );
        }
        if (accrual.isPaid()) {
            throw new SalaryAccrualPaidException(accrual.id);
        }

        const employees = await resolveEmployees(this.directoryRepo);
        const { failures } = await accrueDraftLines(
            this.commandBus,
            accrual,
            command.accruedBy,
            employees,
        );

        // Карточка перечитывается: каждая строка проводилась в своей
        // транзакции над свежей копией документа, локальный агрегат
        // актуального состояния не знает.
        const updated = await this.accrualRepo.findById(command.accrualId);
        return {
            accrual: this.mapper.toDetailResponse(
                updated ?? accrual,
                employees.get(accrual.employeeId) ??
                    SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
            ),
            failures,
        };
    }
}

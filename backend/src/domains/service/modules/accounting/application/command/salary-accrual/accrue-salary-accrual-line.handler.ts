import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SalaryAccrualResponse } from 'ireports-contracts';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import type { BalanceTransactionRepositoryPort } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { SalaryAccrualNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-accrual.exception';
import { SalaryAccrualMapper } from '@/domains/service/modules/accounting/infrastructure/mappers/salary-accrual/salary-accrual.mapper';
import { resolveEmployees } from '../../services/salary-accrual/list-salary-accruals.service';
import { AccrueSalaryAccrualLineCommand } from './accrue-salary-accrual-line.command';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { TaskCompletionSalaryConfig } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Проведение строки документа начисления (PRD 2 docs/payroll-closing-and-
// accrual, Фаза 6, tracer bullet): строка становится деньгами на балансе
// сотрудника. На баланс ложится ровно одно движение SALARY_ACCRUAL на сумму
// снапшота (originalAmount) и — только для скорректированной строки —
// второе, ACCRUAL_ADJUSTMENT на разницу с комментарием корректировки:
// сотрудник в ленте видит, сколько насчитала система и на сколько и почему
// руководитель изменил (см. BalanceTransaction.forAccruedLine).
//
// Запись движений и смена статусов строки/документа — одна транзакция
// UnitOfWork: не бывает проведённой строки без движения и движения без
// проведённой строки. Идемпотентность — двухуровневая: прямой повтор
// останавливает статус строки (markAccrued → 409), гонку параллельных
// запросов — уникальный индекс (lineId, type) в balance_transactions
// (insertMany мапит P2002 в тот же 409); откат транзакции при этом убирает
// и смену статуса.
//
// Хендлер один на оба домена (generic по direction, как
// ReopenAccountingPeriodHandler): направление — данные команды, а
// SALARY_ACCRUAL_REPOSITORY/BALANCE_TRANSACTION_REPOSITORY —
// direction-агностичные реализации.
@CommandHandler(AccrueSalaryAccrualLineCommand)
export class AccrueSalaryAccrualLineHandler implements ICommandHandler<
    AccrueSalaryAccrualLineCommand,
    SalaryAccrualResponse
> {
    private readonly mapper = new SalaryAccrualMapper();

    constructor(
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(BALANCE_TRANSACTION_REPOSITORY)
        private readonly transactionRepo: BalanceTransactionRepositoryPort,
        @Inject(DIRECTORY_REPOSITORY)
        private readonly directoryRepo: DirectoryRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
    ) {}

    async execute(
        command: AccrueSalaryAccrualLineCommand,
    ): Promise<SalaryAccrualResponse> {
        const accrual = await this.accrualRepo.findById(command.accrualId);
        if (!accrual || accrual.direction !== command.direction) {
            throw new SalaryAccrualNotFoundException(
                command.direction,
                command.accrualId,
            );
        }

        const line = accrual.accrueLine(command.lineId);
        const transactions = BalanceTransaction.forAccruedLine(
            accrual,
            line,
            command.accruedBy,
        );

        await this.unitOfWork.run(async () => {
            await this.transactionRepo.insertMany(transactions);
            await this.accrualRepo.save(accrual);
        });

        // deactivate-one-off-task-completion-rule — деактивация разового
        // правила «за выполнение задачи» не должна зависеть от того, каким
        // путём строка попала в ACCRUED: и явный «Указать сумму»
        // (SetTaskCompletionLineRewardHandler), и обычное «Начислить»/
        // «Начислить всё» (эта команда, в т.ч. вызванная построчно из
        // AccrueSalaryAccrualDocumentHandler/AccruePeriodSalaryAccrualsHandler)
        // одинаково означают «деньги по этой задаче начислены». Идемпотентно
        // и симметрично deactivate-логике в SetTaskCompletionLineRewardHandler —
        // уже неактивное или регулярное правило не трогается.
        if (line.type === 'TaskCompletion') {
            const rule = await this.salaryRuleRepo.findById(line.ruleId);
            if (rule && rule.type === 'TaskCompletion' && rule.isActive) {
                const config = rule.config as TaskCompletionSalaryConfig;
                if (config.isRecurring === false) {
                    rule.deactivate();
                    await this.salaryRuleRepo.update(rule);
                }
            }
        }

        const employees = await resolveEmployees(this.directoryRepo);
        return this.mapper.toDetailResponse(
            accrual,
            employees.get(accrual.employeeId) ??
                SalaryAccrualMapper.unknownEmployeeInfo(accrual.employeeId),
        );
    }
}

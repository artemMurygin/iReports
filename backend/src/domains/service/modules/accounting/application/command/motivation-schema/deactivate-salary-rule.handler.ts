import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeactivateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/deactivate-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';

// Soft-деактивация ОДНОГО правила направления service (см. WHY в
// DeactivateSalaryRuleCommand). Намеренно НЕ трогает связанные задачи
// (TaskCompletion) — в отличие от DeleteSalaryRuleHandler, который
// безвозвратно удаляет и правило, и его задачу: деактивация обратима и не
// должна иметь побочных эффектов на tasks.
@CommandHandler(DeactivateSalaryRuleCommand)
export class DeactivateSalaryRuleHandler implements ICommandHandler<
    DeactivateSalaryRuleCommand,
    void
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(command: DeactivateSalaryRuleCommand): Promise<void> {
        await this.unitOfWork.run(async () => {
            const rule = await this.salaryRuleRepo.findById(command.ruleId);
            if (!rule) {
                throw new SalaryRuleNotFoundException(command.ruleId);
            }

            rule.deactivate();
            await this.salaryRuleRepo.update(rule);
        });
    }
}

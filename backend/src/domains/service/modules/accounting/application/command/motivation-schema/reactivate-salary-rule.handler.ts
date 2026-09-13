import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ReactivateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/reactivate-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';

// Обратная операция к DeactivateSalaryRuleHandler — см. WHY в
// ReactivateSalaryRuleCommand.
@CommandHandler(ReactivateSalaryRuleCommand)
export class ReactivateSalaryRuleHandler implements ICommandHandler<
    ReactivateSalaryRuleCommand,
    void
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(command: ReactivateSalaryRuleCommand): Promise<void> {
        await this.unitOfWork.run(async () => {
            const rule = await this.salaryRuleRepo.findById(command.ruleId);
            if (!rule) {
                throw new SalaryRuleNotFoundException(command.ruleId);
            }

            rule.activate();
            await this.salaryRuleRepo.update(rule);
        });
    }
}

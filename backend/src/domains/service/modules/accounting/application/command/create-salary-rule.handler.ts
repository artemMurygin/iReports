import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/create-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../ports/salary-rule.port';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';

@CommandHandler(CreateSalaryRuleCommand)
export class CreateSalaryRuleHandler implements ICommandHandler<
    CreateSalaryRuleCommand,
    { id: string }
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
    ) {}

    async execute(command: CreateSalaryRuleCommand): Promise<{ id: string }> {
        const rule = SalaryRuleFactory.create(command.rule);

        await this.salaryRuleRepo.insert(rule, {
            motivationSchemaId: command.motivationSchemaId,
        });

        return { id: rule.id };
    }
}

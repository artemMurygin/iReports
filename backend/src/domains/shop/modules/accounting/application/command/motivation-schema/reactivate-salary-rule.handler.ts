import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ReactivateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/reactivate-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';

// Зеркало domains/service/modules/accounting'ного ReactivateSalaryRuleHandler
// (независимая копия, issue #57) — реактивация ранее деактивированного
// правила направления shop. Симметрично DeactivateShopSalaryRuleHandler:
// связанные задачи (TaskCompletion) не затрагиваются.
@CommandHandler(ReactivateShopSalaryRuleCommand)
export class ReactivateShopSalaryRuleHandler implements ICommandHandler<
    ReactivateShopSalaryRuleCommand,
    void
> {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(command: ReactivateShopSalaryRuleCommand): Promise<void> {
        await this.unitOfWork.run(async () => {
            const rule = await this.shopSalaryRuleRepo.findById(command.ruleId);
            if (!rule) {
                throw new ShopSalaryRuleNotFoundException(command.ruleId);
            }

            rule.activate();
            await this.shopSalaryRuleRepo.update(rule);
        });
    }
}

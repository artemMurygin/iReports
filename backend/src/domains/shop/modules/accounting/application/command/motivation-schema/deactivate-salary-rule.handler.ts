import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeactivateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/deactivate-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';

// Зеркало domains/service/modules/accounting'ного DeactivateSalaryRuleHandler
// (независимая копия, issue #57) — soft-деактивация ОДНОГО правила
// направления shop. Намеренно НЕ трогает связанные задачи (TaskCompletion) —
// в отличие от DeleteShopSalaryRuleHandler, который безвозвратно удаляет и
// правило, и его задачу: деактивация обратима и не должна иметь побочных
// эффектов на tasks.
@CommandHandler(DeactivateShopSalaryRuleCommand)
export class DeactivateShopSalaryRuleHandler implements ICommandHandler<
    DeactivateShopSalaryRuleCommand,
    void
> {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
    ) {}

    async execute(command: DeactivateShopSalaryRuleCommand): Promise<void> {
        await this.unitOfWork.run(async () => {
            const rule = await this.shopSalaryRuleRepo.findById(command.ruleId);
            if (!rule) {
                throw new ShopSalaryRuleNotFoundException(command.ruleId);
            }

            rule.deactivate();
            await this.shopSalaryRuleRepo.update(rule);
        });
    }
}

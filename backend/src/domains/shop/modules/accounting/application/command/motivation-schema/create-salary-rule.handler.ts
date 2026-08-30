import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';

// Зеркало domains/service/modules/accounting/application/command/
// create-salary-rule.handler.ts (Фаза 13.5, issue #57) — независимая копия
// для направления shop.
@CommandHandler(CreateShopSalaryRuleCommand)
export class CreateShopSalaryRuleHandler implements ICommandHandler<
    CreateShopSalaryRuleCommand,
    { id: string }
> {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        protected readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
    ) {}

    async execute(
        command: CreateShopSalaryRuleCommand,
    ): Promise<{ id: string }> {
        const rule = ShopSalaryRuleFactory.create(command.rule);

        await this.shopSalaryRuleRepo.insert(rule, {
            motivationSchemaId: command.motivationSchemaId,
        });

        return { id: rule.id };
    }
}

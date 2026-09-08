import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '../../ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '../../ports/motivation-schema/salary-rule.port';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';

// Зеркало domains/service/modules/accounting/application/command/
// create-salary-rule.handler.ts (issue #57) — независимая копия для
// направления shop.
//
// openspec/changes/replace-bitrix-task-integration, design.md решение 4 —
// правило TaskCompletion больше НЕ создаёт ничего в Bitrix24/tasks здесь:
// фронт создаёт задачу отдельным, самостоятельным запросом (POST
// /v1/tasks) ДО этого запроса и передаёт уже готовый taskId в теле
// (ireports-contracts: TaskCompletionShopSalaryConfigRequest); этот хендлер
// просто сохраняет правило, как и любой другой тип — TaskCompletionShop.
// create() сама транслирует taskId в config.taskIdByPeriod[текущийПериод]
// (см. task-completion.entity.ts). Раньше действовавшая атомарность
// "правило и первая задача коммитятся вместе или обе откатываются" и
// Bitrix-компенсация ОТМЕНЕНЫ этим решением — они были нужны именно из-за
// совместного создания в одном запросе, которого больше нет.
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

import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/motivation-schema/delete-salary-rule.command';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { ShopSalaryRuleNotFoundException } from '@/domains/shop/modules/accounting/domain/exceptions/salary-rule.exception';
import type { TaskCompletionShopSalaryConfig } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { Period } from '@/shared/domain/period.value-object';
import { DeleteTaskCommand } from '@/modules/tasks/application/command/delete-task/delete-task.command';
import { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';

// Зеркало domains/service/modules/accounting'ного DeleteSalaryRuleHandler
// (независимая копия, issue #57) — то же WHY: TaskCompletionShop не может
// существовать без своей задачи, поэтому удаление правила и его задачи —
// одна немедленная операция, без промежуточного "правило есть, задачи уже
// нет" состояния. Hard-delete (DeleteTaskCommand) — только для задачи
// ТЕКУЩЕГО периода (единственной, видимой в форме правила), задачи прошлых
// периодов регулярного правила мягко отменяются (CancelTaskForRuleDeletionService)
// — история начислений не теряется.
@CommandHandler(DeleteShopSalaryRuleCommand)
export class DeleteShopSalaryRuleHandler implements ICommandHandler<
    DeleteShopSalaryRuleCommand,
    void
> {
    constructor(
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        private readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly commandBus: CommandBus,
        private readonly cancelTaskForRuleDeletion: CancelTaskForRuleDeletionService,
    ) {}

    async execute(command: DeleteShopSalaryRuleCommand): Promise<void> {
        await this.unitOfWork.run(async () => {
            const rule = await this.shopSalaryRuleRepo.findById(command.ruleId);
            if (!rule) {
                throw new ShopSalaryRuleNotFoundException(command.ruleId);
            }

            await this.shopSalaryRuleRepo.deleteByIds([rule.id]);

            if (rule.type === 'TaskCompletion') {
                const config = rule.config as TaskCompletionShopSalaryConfig;
                const currentPeriod = Period.current().getValue();
                for (const [period, taskId] of Object.entries(
                    config.taskIdByPeriod,
                )) {
                    if (period === currentPeriod) {
                        await this.commandBus.execute(
                            new DeleteTaskCommand({ taskId }),
                        );
                    } else {
                        await this.cancelTaskForRuleDeletion.cancel(taskId);
                    }
                }
            }
        });
    }
}

import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/delete-salary-rule.command';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SalaryRuleNotFoundException } from '@/domains/service/modules/accounting/domain/exceptions/salary-rule.exception';
import type { TaskCompletionSalaryConfig } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { Period } from '@/shared/domain/period.value-object';
import { DeleteTaskCommand } from '@/modules/tasks/application/command/delete-task/delete-task.command';
import { CancelTaskForRuleDeletionService } from '@/modules/tasks/application/services/cancel-task-for-rule-deletion.service';

// add-task-rule-task-lifecycle — правило TaskCompletion не может
// существовать без своей задачи (та и есть предмет правила: начисление
// срабатывает на её закрытие, `TaskCompletion.calculate()`). Раньше
// удаление задачи из формы правила (`features/SalaryRuleForm`'s "Удалить
// задачу") только чистило `draft.taskId` локально и требовало отдельного
// «Сохранить схему» — если пользователь уходил со страницы без сохранения,
// уже удалённая задача (DELETE /v1/tasks/:id, безвозвратно) оставалась
// висящей ссылкой (`config.taskIdByPeriod`) в персистентном правиле.
// Правило и его задача теперь удаляются здесь ОДНОЙ операцией, сразу и
// безвозвратно — без промежуточного состояния «правило есть, задачи уже
// нет».
//
// Регулярное правило может нести НЕСКОЛЬКО задач в config.taskIdByPeriod (по
// одной на прошедший период) — их прошлые задачи могли уже породить
// начисления (SalaryAccrual/SalaryAccrualLine), которым важна история, а не
// только текущая. Поэтому hard-delete (DeleteTaskCommand) применяется ТОЛЬКО
// к задаче ТЕКУЩЕГО периода — единственной, которую пользователь вообще
// видит и может удалить кнопкой в форме правила (ruleDraft.ts: draft.taskId
// заводится только из текущего периода). Задачи прошлых периодов
// обрабатываются тем же мягким переводом в терминальный статус
// (CancelTaskForRuleDeletionService), что и обычное удаление правила через
// PATCH схемы (UpdateMotivationSchemaHandler.cancelTaskCompletionTasks) —
// история начислений не теряется.
@CommandHandler(DeleteSalaryRuleCommand)
export class DeleteSalaryRuleHandler implements ICommandHandler<
    DeleteSalaryRuleCommand,
    void
> {
    constructor(
        @Inject(SALARY_RULE_REPOSITORY)
        private readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly commandBus: CommandBus,
        private readonly cancelTaskForRuleDeletion: CancelTaskForRuleDeletionService,
    ) {}

    async execute(command: DeleteSalaryRuleCommand): Promise<void> {
        await this.unitOfWork.run(async () => {
            const rule = await this.salaryRuleRepo.findById(command.ruleId);
            if (!rule) {
                throw new SalaryRuleNotFoundException(command.ruleId);
            }

            // Правило удаляется ПЕРЕД задачами: если что-то из шагов ниже
            // упадёт, останется максимум осиротевшая (уже безвредная)
            // задача без правила — не наоборот (правило, ссылающееся на
            // удалённую задачу), именно та проблема, которую чинит эта
            // команда.
            await this.salaryRuleRepo.deleteByIds([rule.id]);

            if (rule.type === 'TaskCompletion') {
                const config = rule.config as TaskCompletionSalaryConfig;
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

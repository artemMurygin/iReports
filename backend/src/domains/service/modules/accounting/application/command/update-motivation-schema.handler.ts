import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/update-motivation-schema.command';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/create-salary-rule.command';
import { NotFoundException } from '@/shared/exceptions';
import type { MotivationSchemaRepositoryPort } from '../ports/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../ports/motivation-schema.port';
import type { SalaryRuleRepositoryPort } from '../ports/salary-rule.port';
import { SALARY_RULE_REPOSITORY } from '../ports/salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { MotivationResponse } from 'ireports-contracts';
import { TaskCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/task-completed.entity';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { TaskRuleBitrixDeletionFailedException } from '@/domains/service/modules/accounting/domain/exceptions/task-rule.exception';
import { BitrixTasksService } from '@/integrations/bitrix/bitrix-tasks.service';

@CommandHandler(UpdateMotivationSchemaCommand)
export class UpdateMotivationSchemaHandler implements ICommandHandler<
    UpdateMotivationSchemaCommand,
    MotivationResponse
> {
    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(SALARY_RULE_REPOSITORY)
        protected readonly salaryRuleRepo: SalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        protected readonly commandBus: CommandBus,
        protected readonly bitrixTasksService: BitrixTasksService,
    ) {}

    async execute(
        command: UpdateMotivationSchemaCommand,
    ): Promise<MotivationResponse> {
        // Переименование + полная замена набора правил направления service
        // должны быть атомарны (см. apiDesign плана: "rename + replace all
        // rules of THIS direction"), поэтому весь сценарий — find → rename →
        // delete-all-service-rules → recreate — идёт внутри одной
        // транзакции, тем же приёмом, что и CreateMotivationSchemaHandler.
        const motivationSchemaId = await this.unitOfWork.run(async () => {
            const schema = await this.motivationSchemaRepo.findById(
                command.motivationSchemaId,
            );

            // Строки нет ИЛИ у неё 0 правил direction='service' — та же
            // 404-семантика, что и у GetMotivationSchemaService (см.
            // apiDesign плана).
            if (!schema || schema.getProps().rules.length === 0) {
                throw new NotFoundException('Мотивационная схема не найдена');
            }

            // Requirement "Удаление задачи Bitrix24 при удалении правила или
            // схемы" (spec.md, design.md Decision 4/10): полная замена
            // набора правил (см. WHY ниже у deleteAllByMotivationSchema) в
            // этой реализации означает, что КАЖДОЕ существующее правило
            // TaskCompleted схемы удаляется этим PATCH и — если руководитель
            // оставил его в форме — пересоздаётся заново командой 6.2 ниже
            // со своей новой задачей Bitrix24. Поэтому связанные задачи
            // Bitrix24 всех существующих правил TaskCompleted удаляются
            // ЗАРАНЕЕ, до deleteAllByMotivationSchema и до commandBus.execute
            // ниже: если удаление в Bitrix24 не удалось — команда
            // прерывается здесь, схема не переименовывается и не
            // перезаписывается (правило "остаётся в схеме мотивации", как
            // требует spec.md, — поскольку ничего в этой транзакции ещё не
            // записано).
            await this.deleteExistingTaskRuleBitrixTasks(
                schema.getProps().rules,
            );

            schema.rename(command.name);
            await this.motivationSchemaRepo.update(schema);

            // direction='service' зафиксирован внутри репозитория — правила
            // направления shop той же строки motivation_schemas (сотрудник с
            // идентичностями в обеих ERP) не затрагиваются.
            await this.salaryRuleRepo.deleteAllByMotivationSchema(schema.id);

            // responsibleId — та же цель схемы, что и в
            // CreateMotivationSchemaHandler (Requirement "Создание
            // правила-задачи только в схеме на сотрудника").
            const target = schema.getProps().target;
            const responsibleId = target.isEmployee() ? target.getId() : null;

            // Пересоздание правил через тот же CreateSalaryRuleCommand, что
            // и CreateMotivationSchemaHandler — код создания правила не
            // дублируется, вся дельта между старым и новым набором правил
            // вычисляется неявно (полная замена, без diff).
            for (const rule of command.rules) {
                await this.commandBus.execute(
                    new CreateSalaryRuleCommand({
                        motivationSchemaId: schema.id,
                        rule,
                        responsibleId,
                    }),
                );
            }

            return schema.id;
        });

        return { id: motivationSchemaId };
    }

    private async deleteExistingTaskRuleBitrixTasks(
        rules: readonly SalaryRule[],
    ): Promise<void> {
        const taskIds = rules
            .filter(
                (rule): rule is TaskCompletedEntity =>
                    rule instanceof TaskCompletedEntity,
            )
            .flatMap((rule) => rule.bitrixTaskIds);

        for (const taskId of taskIds) {
            try {
                await this.bitrixTasksService.deleteTask(taskId);
            } catch (err) {
                throw new TaskRuleBitrixDeletionFailedException(
                    taskId,
                    err instanceof Error ? err : undefined,
                );
            }
        }
    }
}

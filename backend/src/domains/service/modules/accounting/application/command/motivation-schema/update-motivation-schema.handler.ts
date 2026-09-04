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

            schema.rename(command.name);
            await this.motivationSchemaRepo.update(schema);

            // direction='service' зафиксирован внутри репозитория — правила
            // направления shop той же строки motivation_schemas (сотрудник с
            // идентичностями в обеих ERP) не затрагиваются.
            await this.salaryRuleRepo.deleteAllByMotivationSchema(schema.id);

            // Пересоздание правил через тот же CreateSalaryRuleCommand, что
            // и CreateMotivationSchemaHandler — код создания правила не
            // дублируется, вся дельта между старым и новым набором правил
            // вычисляется неявно (полная замена, без diff).
            for (const rule of command.rules) {
                await this.commandBus.execute(
                    new CreateSalaryRuleCommand({
                        motivationSchemaId: schema.id,
                        rule,
                    }),
                );
            }

            return schema.id;
        });

        return { id: motivationSchemaId };
    }
}

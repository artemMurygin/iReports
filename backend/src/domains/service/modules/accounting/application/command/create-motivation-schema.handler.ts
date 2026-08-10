import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/create-motivation-schema.command';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/create-salary-rule.command';
import { Inject } from '@nestjs/common';
import type { MotivationSchemaRepositoryPort } from '../ports/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../ports/motivation-schema.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { SalaryRuleFactory } from '@/domains/service/modules/accounting/domain/factories/salary-rule.factory';
import { MotivationResponse } from 'ireports-contracts';

@CommandHandler(CreateMotivationSchemaCommand)
export class CreateMotivationSchemaHandler implements ICommandHandler<
    CreateMotivationSchemaCommand,
    MotivationResponse
> {
    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        protected readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: CreateMotivationSchemaCommand,
    ): Promise<MotivationResponse> {
        const motivationSchema = MotivationSchema.create({
            targetType: command.targetType,
            targetId: command.targetId,
            name: command.name,
            rules: command.rules.map((rule) => SalaryRuleFactory.create(rule)),
        });

        // Схема и все её правила должны появиться в БД атомарно, поэтому
        // insert схемы и диспатч команд на создание правил идут внутри одной
        // транзакции. Каждый репозиторий сам оборачивает свою запись в
        // db.withTransaction() (см. PrismaRepository.write), но раз она уже
        // открыта здесь, вложенные вызовы лишь переиспользуют текущий
        // TransactionClient (reentrancy-guard в withTransaction), а не
        // открывают свою — и события агрегатов опубликуются одним пакетом
        // только после коммита именно этой, внешней транзакции.
        await this.unitOfWork.run(async () => {
            await this.motivationSchemaRepo.insert(motivationSchema);

            for (const rule of command.rules) {
                await this.commandBus.execute(
                    new CreateSalaryRuleCommand({
                        motivationSchemaId: motivationSchema.id,
                        rule,
                    }),
                );
            }
        });

        return { id: motivationSchema.id };
    }
}

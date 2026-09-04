import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateMotivationSchemaCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-motivation-schema.command';
import { CreateSalaryRuleCommand } from '@/domains/service/modules/accounting/application/command/motivation-schema/create-salary-rule.command';
import { Inject } from '@nestjs/common';
import type { MotivationSchemaRepositoryPort } from '../../ports/motivation-schema/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '../../ports/motivation-schema/motivation-schema.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
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
        // Схема и все её правила должны появиться в БД атомарно, поэтому
        // find-or-create схемы и диспатч команд на создание правил идут
        // внутри одной транзакции. Каждый репозиторий сам оборачивает свою
        // запись в db.withTransaction() (см. PrismaRepository.write), но раз
        // она уже открыта здесь, вложенные вызовы лишь переиспользуют
        // текущий TransactionClient (reentrancy-guard в withTransaction), а
        // не открывают свою — и события агрегатов опубликуются одним пакетом
        // только после коммита именно этой, внешней транзакции.
        const motivationSchemaId = await this.unitOfWork.run(async () => {
            // У MotivationSchema нет колонки direction — targetType/targetId
            // это весь естественный ключ. Сотрудник с идентичностями в обеих
            // ERP мог получить схему уже с другой стороны (см. shop-версию
            // этого хендлера), поэтому вставлять новую строку можно только
            // когда её ещё нет.
            const existingId = await this.motivationSchemaRepo.findIdByTarget(
                command.targetType,
                command.targetId,
            );

            let motivationSchemaId: string;

            if (existingId) {
                motivationSchemaId = existingId;
                // Строка уже существует (создана раньше со стороны shop для
                // того же targetType/targetId), но это может быть первый
                // create-запрос со стороны service — initializeName
                // выставляет serviceName только если он ещё не задан
                // (идемпотентно), иначе кросс-направленческий POST молча
                // терял бы своё name (тот самый баг с общим `name`, см.
                // комментарий у serviceName в salary.prisma). Повторный
                // POST с уже инициализированным serviceName ничего не
                // меняет — переименование делает только PATCH.
                await this.motivationSchemaRepo.initializeName(
                    motivationSchemaId,
                    command.name,
                );
            } else {
                const motivationSchema = MotivationSchema.create({
                    targetType: command.targetType,
                    targetId: command.targetId,
                    name: command.name,
                    rules: command.rules.map((rule) =>
                        SalaryRuleFactory.create(rule),
                    ),
                });
                await this.motivationSchemaRepo.insert(motivationSchema);
                motivationSchemaId = motivationSchema.id;
            }

            for (const rule of command.rules) {
                await this.commandBus.execute(
                    new CreateSalaryRuleCommand({
                        motivationSchemaId,
                        rule,
                    }),
                );
            }

            return motivationSchemaId;
        });

        return { id: motivationSchemaId };
    }
}

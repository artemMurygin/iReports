import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/create-shop-motivation-schema.command';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/create-shop-salary-rule.command';
import { Inject } from '@nestjs/common';
import type { ShopMotivationSchemaRepositoryPort } from '../ports/shop-motivation-schema.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '../ports/shop-motivation-schema.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { ShopSalaryRuleFactory } from '@/domains/shop/modules/accounting/domain/factories/salary-rule.factory';
import { ShopMotivationResponse } from 'ireports-contracts';

// Зеркало domains/service/modules/accounting/application/command/
// create-motivation-schema.handler.ts (Фаза 13.5, issue #57) — независимая
// копия для направления shop.
@CommandHandler(CreateShopMotivationSchemaCommand)
export class CreateShopMotivationSchemaHandler implements ICommandHandler<
    CreateShopMotivationSchemaCommand,
    ShopMotivationResponse
> {
    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        protected readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: CreateShopMotivationSchemaCommand,
    ): Promise<ShopMotivationResponse> {
        // Схема и все её правила должны появиться в БД атомарно, поэтому
        // find-or-create схемы и диспатч команд на создание правил идут
        // внутри одной транзакции — см. комментарий сервисного
        // CreateMotivationSchemaHandler.
        const motivationSchemaId = await this.unitOfWork.run(async () => {
            // У ShopMotivationSchema нет колонки direction — targetType/
            // targetId это весь естественный ключ. Сотрудник с
            // идентичностями в обеих ERP мог получить схему уже с другой
            // стороны (см. сервисный CreateMotivationSchemaHandler),
            // поэтому вставлять новую строку можно только когда её ещё нет.
            const existingId =
                await this.shopMotivationSchemaRepo.findIdByTarget(
                    command.targetType as 'Department' | 'Employee',
                    command.targetId,
                );

            let motivationSchemaId: string;

            if (existingId) {
                motivationSchemaId = existingId;
            } else {
                const motivationSchema = ShopMotivationSchema.create({
                    targetType: command.targetType,
                    targetId: command.targetId,
                    name: command.name,
                    rules: command.rules.map((rule) =>
                        ShopSalaryRuleFactory.create(rule),
                    ),
                });
                await this.shopMotivationSchemaRepo.insert(motivationSchema);
                motivationSchemaId = motivationSchema.id;
            }

            for (const rule of command.rules) {
                await this.commandBus.execute(
                    new CreateShopSalaryRuleCommand({
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

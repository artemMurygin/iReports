import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateShopMotivationSchemaCommand } from '@/domains/shop/modules/accounting/application/command/update-shop-motivation-schema.command';
import { CreateShopSalaryRuleCommand } from '@/domains/shop/modules/accounting/application/command/create-shop-salary-rule.command';
import { NotFoundException } from '@/shared/exceptions';
import type { ShopMotivationSchemaRepositoryPort } from '../ports/shop-motivation-schema.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '../ports/shop-motivation-schema.port';
import type { ShopSalaryRuleRepositoryPort } from '../ports/shop-salary-rule.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '../ports/shop-salary-rule.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationResponse } from 'ireports-contracts';

// Зеркало domains/service/modules/accounting/application/command/
// update-motivation-schema.handler.ts (Фаза "Редактирование зарплатных
// схем", issue #57) — независимая копия для направления shop.
@CommandHandler(UpdateShopMotivationSchemaCommand)
export class UpdateShopMotivationSchemaHandler implements ICommandHandler<
    UpdateShopMotivationSchemaCommand,
    ShopMotivationResponse
> {
    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        protected readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(SHOP_SALARY_RULE_REPOSITORY)
        protected readonly shopSalaryRuleRepo: ShopSalaryRuleRepositoryPort,
        @Inject(UNIT_OF_WORK)
        protected readonly unitOfWork: UnitOfWorkPort,
        protected readonly commandBus: CommandBus,
    ) {}

    async execute(
        command: UpdateShopMotivationSchemaCommand,
    ): Promise<ShopMotivationResponse> {
        // Переименование + полная замена набора правил направления shop
        // должны быть атомарны (см. apiDesign плана: "rename + replace all
        // rules of THIS direction"), поэтому весь сценарий — find → rename →
        // delete-all-shop-rules → recreate — идёт внутри одной транзакции,
        // тем же приёмом, что и CreateShopMotivationSchemaHandler.
        const motivationSchemaId = await this.unitOfWork.run(async () => {
            const schema = await this.shopMotivationSchemaRepo.findById(
                command.motivationSchemaId,
            );

            // Строки нет ИЛИ у неё 0 правил direction='shop' — та же
            // 404-семантика, что и у GetShopMotivationSchemaService (см.
            // apiDesign плана).
            if (!schema || schema.getProps().rules.length === 0) {
                throw new NotFoundException('Мотивационная схема не найдена');
            }

            schema.rename(command.name);
            await this.shopMotivationSchemaRepo.update(schema);

            // direction='shop' зафиксирован внутри репозитория — правила
            // направления service той же строки motivation_schemas
            // (сотрудник с идентичностями в обеих ERP) не затрагиваются.
            await this.shopSalaryRuleRepo.deleteAllByMotivationSchema(
                schema.id,
            );

            // Пересоздание правил через тот же CreateShopSalaryRuleCommand,
            // что и CreateShopMotivationSchemaHandler — код создания
            // правила не дублируется, вся дельта между старым и новым
            // набором правил вычисляется неявно (полная замена, без diff).
            for (const rule of command.rules) {
                await this.commandBus.execute(
                    new CreateShopSalaryRuleCommand({
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

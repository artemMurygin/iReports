import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@/shared/exceptions';
import { DeleteShopMotivationSchemaCommand } from './delete-motivation-schema.command';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';

// Зеркало domains/service/modules/accounting/application/command/
// motivation-schema/delete-motivation-schema.handler.ts — независимая копия
// для направления shop. Implements FR2, FR3 of delete-motivation-schema.
@CommandHandler(DeleteShopMotivationSchemaCommand)
export class DeleteShopMotivationSchemaHandler implements ICommandHandler<
    DeleteShopMotivationSchemaCommand,
    void
> {
    constructor(
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly repo: ShopMotivationSchemaRepositoryPort,
    ) {}

    async execute(command: DeleteShopMotivationSchemaCommand): Promise<void> {
        const schema = await this.repo.findById(command.schemaId);

        // Тот же критерий "не найдено", что у GetShopMotivationSchemaService
        // — строки нет ИЛИ у неё 0 правил направления shop.
        if (!schema || schema.getProps().rules.length === 0) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }

        await this.repo.deleteDirectionSchema(command.schemaId);
    }
}

import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@/shared/exceptions';
import { DeleteMotivationSchemaCommand } from './delete-motivation-schema.command';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';

// Implements FR1, FR3 of delete-motivation-schema.
@CommandHandler(DeleteMotivationSchemaCommand)
export class DeleteMotivationSchemaHandler implements ICommandHandler<
    DeleteMotivationSchemaCommand,
    void
> {
    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly repo: MotivationSchemaRepositoryPort,
    ) {}

    async execute(command: DeleteMotivationSchemaCommand): Promise<void> {
        const schema = await this.repo.findById(command.schemaId);

        // Тот же критерий "не найдено", что у GetMotivationSchemaService —
        // строки нет ИЛИ у неё 0 правил направления service (правила чужого
        // направления той же общей строки этому домену не видны).
        if (!schema || schema.getProps().rules.length === 0) {
            throw new NotFoundException('Мотивационная схема не найдена');
        }

        await this.repo.deleteDirectionSchema(command.schemaId);
    }
}

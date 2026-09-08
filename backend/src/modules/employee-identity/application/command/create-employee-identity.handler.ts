import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { CreateEmployeeIdentityCommand } from './create-employee-identity.command';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentityAlreadyExistsException } from '../../domain/exceptions/employee-identity.exception';
import { toEmployeeIdentityResponse } from '../mappers/to-employee-identity-response';

@CommandHandler(CreateEmployeeIdentityCommand)
export class CreateEmployeeIdentityHandler implements ICommandHandler<
    CreateEmployeeIdentityCommand,
    EmployeeIdentityResponse
> {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(
        command: CreateEmployeeIdentityCommand,
    ): Promise<EmployeeIdentityResponse> {
        // Проверка "на чтение" перед вставкой — дружелюбное сообщение в
        // обычном случае; уникальный индекс в БД (@@unique в
        // employee-identity.prisma) остаётся последней линией защиты от
        // гонки двух параллельных запросов на один и тот же идентификатор.
        const existing = await this.repo.findByExternalId(
            command.system,
            command.identifierType,
            command.externalId,
        );
        if (existing) {
            throw new EmployeeIdentityAlreadyExistsException(
                `Идентификатор "${command.externalId}" уже привязан к другому сотруднику в системе ${command.system}`,
            );
        }

        const identity = EmployeeIdentity.create({
            bitrixEmployeeId: command.bitrixEmployeeId,
            system: command.system,
            identifierType: command.identifierType,
            externalId: command.externalId,
        });

        await this.repo.insert(identity);

        return toEmployeeIdentityResponse(identity);
    }
}

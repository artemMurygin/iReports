import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { UpdateEmployeeIdentityCommand } from './update-employee-identity.command';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import {
    EmployeeIdentityAlreadyExistsException,
    EmployeeIdentityNotFoundException,
} from '../../domain/exceptions/employee-identity.exception';
import { toEmployeeIdentityResponse } from '../mappers/to-employee-identity-response';

@CommandHandler(UpdateEmployeeIdentityCommand)
export class UpdateEmployeeIdentityHandler implements ICommandHandler<
    UpdateEmployeeIdentityCommand,
    EmployeeIdentityResponse
> {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(
        command: UpdateEmployeeIdentityCommand,
    ): Promise<EmployeeIdentityResponse> {
        const identity = await this.repo.findById(command.identityId);
        if (!identity) {
            throw new EmployeeIdentityNotFoundException();
        }

        // Правка меняет только сам идентификатор — проверяем уникальность
        // только тогда, когда что-то из пары (identifierType, externalId)
        // реально меняется, и исключаем саму запись из проверки конфликта.
        if (
            command.identifierType !== undefined ||
            command.externalId !== undefined
        ) {
            const nextIdentifierType =
                command.identifierType ?? identity.identifierType;
            const nextExternalId = command.externalId ?? identity.externalId;

            const clashing = await this.repo.findByExternalId(
                identity.system,
                nextIdentifierType,
                nextExternalId,
            );
            if (clashing && clashing.id !== identity.id) {
                throw new EmployeeIdentityAlreadyExistsException(
                    `Идентификатор "${nextExternalId}" уже привязан к другому сотруднику в системе ${identity.system}`,
                );
            }
        }

        identity.update({
            identifierType: command.identifierType,
            externalId: command.externalId,
        });
        await this.repo.update(identity);

        return toEmployeeIdentityResponse(identity);
    }
}

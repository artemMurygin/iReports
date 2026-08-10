import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteEmployeeIdentityCommand } from './delete-employee-identity.command';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentityNotFoundException } from '../../domain/exceptions/employee-identity.exception';

@CommandHandler(DeleteEmployeeIdentityCommand)
export class DeleteEmployeeIdentityHandler implements ICommandHandler<
    DeleteEmployeeIdentityCommand,
    void
> {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(command: DeleteEmployeeIdentityCommand): Promise<void> {
        const identity = await this.repo.findById(command.identityId);
        if (!identity) {
            throw new EmployeeIdentityNotFoundException();
        }

        await this.repo.delete(command.identityId);
    }
}

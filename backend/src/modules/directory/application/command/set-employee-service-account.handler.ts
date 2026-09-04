import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { SetEmployeeServiceAccountResponse } from 'ireports-contracts';
import { SetEmployeeServiceAccountCommand } from './set-employee-service-account.command';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { EmployeeNotFoundException } from '@/modules/directory/domain/exceptions/employee.exception';
import { toEmployeeWithServiceAccountResponse } from '@/modules/directory/application/mappers/to-employee-with-service-account-response';

@CommandHandler(SetEmployeeServiceAccountCommand)
export class SetEmployeeServiceAccountHandler implements ICommandHandler<
    SetEmployeeServiceAccountCommand,
    SetEmployeeServiceAccountResponse
> {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly repo: DirectoryRepositoryPort,
    ) {}

    async execute(
        command: SetEmployeeServiceAccountCommand,
    ): Promise<SetEmployeeServiceAccountResponse> {
        const employee = await this.repo.setServiceAccount(
            command.employeeId,
            command.isServiceAccount,
        );
        if (!employee) {
            throw new EmployeeNotFoundException();
        }
        return toEmployeeWithServiceAccountResponse(employee);
    }
}

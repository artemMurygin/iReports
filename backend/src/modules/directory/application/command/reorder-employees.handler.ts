import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { ReorderEmployeesResponse } from 'ireports-contracts';
import { ReorderEmployeesCommand } from './reorder-employees.command';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { toEmployeeResponse } from '@/modules/directory/application/mappers/to-employee-response';

// Пишет новый order каждого перечисленного сотрудника одной транзакцией
// (DirectoryRepository.updateEmployeesOrder), затем перечитывает весь
// справочник (уже отсортированный по order — см. DirectoryRepository.
// findEmployees) — так вызывающий сразу видит применённый порядок, без
// отдельного повторного GET.
@CommandHandler(ReorderEmployeesCommand)
export class ReorderEmployeesHandler implements ICommandHandler<
    ReorderEmployeesCommand,
    ReorderEmployeesResponse
> {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly repo: DirectoryRepositoryPort,
    ) {}

    async execute(
        command: ReorderEmployeesCommand,
    ): Promise<ReorderEmployeesResponse> {
        await this.repo.updateEmployeesOrder(command.items);
        const employees = await this.repo.findEmployees();
        return employees.map(toEmployeeResponse);
    }
}

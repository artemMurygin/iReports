import { Inject, Injectable } from '@nestjs/common';
import type { ListEmployeesWithServiceAccountResponse } from 'ireports-contracts';
import { DIRECTORY_REPOSITORY } from '../ports/directory.port';
import type { DirectoryRepositoryPort } from '../ports/directory.port';
import { toEmployeeWithServiceAccountResponse } from '../mappers/to-employee-with-service-account-response';

// Полный справочник сотрудников (ВСЕ, включая служебные аккаунты) с их
// текущим isServiceAccount (docs/employee-ordering-and-salary-filter,
// Фаза 4) — сознательно НЕ переиспользует ListEmployeesService: тот по
// умолчанию фильтрует isServiceAccount: false и не отдаёт сам флаг (см. WHY
// в contracts/commands/directory.ts на listEmployeesWithServiceAccountResponseSchema).
// Питает список с переключателем «исключить из зарплаты» на странице
// настроек и справочник сотрудников на странице «Связи сотрудников»
// (та обязана продолжать видеть служебные аккаунты).
@Injectable()
export class ListEmployeesWithServiceAccountService {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly repo: DirectoryRepositoryPort,
    ) {}

    async execute(): Promise<ListEmployeesWithServiceAccountResponse> {
        const employees = await this.repo.findEmployees(undefined, {
            includeServiceAccounts: true,
        });
        return employees.map(toEmployeeWithServiceAccountResponse);
    }
}

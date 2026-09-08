import { Inject, Injectable } from '@nestjs/common';
import type { ListEmployeesResponse } from 'ireports-contracts';
import { DIRECTORY_REPOSITORY } from '../ports/directory.port';
import type { DirectoryRepositoryPort } from '../ports/directory.port';
import { toEmployeeResponse } from '../mappers/to-employee-response';

// Список сотрудников Bitrix для селекта «Сотрудник» на Шаге 1 формы
// создания зарплатной схемы (docs/salary-schema-creation-ui, Фаза 1),
// опционально отфильтрованный по отделу.
@Injectable()
export class ListEmployeesService {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly repo: DirectoryRepositoryPort,
    ) {}

    async execute(departmentId?: number): Promise<ListEmployeesResponse> {
        const employees = await this.repo.findEmployees(departmentId);
        return employees.map(toEmployeeResponse);
    }
}

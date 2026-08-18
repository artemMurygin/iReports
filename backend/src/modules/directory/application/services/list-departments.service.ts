import { Inject, Injectable } from '@nestjs/common';
import type { ListDepartmentsResponse } from 'ireports-contracts';
import { DIRECTORY_REPOSITORY } from '../ports/directory.port';
import type { DirectoryRepositoryPort } from '../ports/directory.port';

// Список отделов Bitrix для селекта «Отдел» на Шаге 1 формы создания
// зарплатной схемы (docs/salary-schema-creation-ui, Фаза 1).
@Injectable()
export class ListDepartmentsService {
    constructor(
        @Inject(DIRECTORY_REPOSITORY)
        private readonly repo: DirectoryRepositoryPort,
    ) {}

    async execute(): Promise<ListDepartmentsResponse> {
        return this.repo.findDepartments();
    }
}

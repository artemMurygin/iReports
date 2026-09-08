import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { toEmployeeIdentityResponse } from '../mappers/to-employee-identity-response';

// Все связи разом — вход для экрана «сотрудники × их связи», который строит
// таблицу по всему справочнику сотрудников сразу.
//
// Отдельный сервис, а не опциональный аргумент у ListEmployeeIdentitiesService:
// там вход — конкретный сотрудник (карточка), здесь входа нет вообще, и
// execute(id?) прятал бы два разных сценария за одним необязательным
// параметром.
@Injectable()
export class ListAllEmployeeIdentitiesService {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(): Promise<EmployeeIdentityResponse[]> {
        const identities = await this.repo.findAll();
        return identities.map(toEmployeeIdentityResponse);
    }
}

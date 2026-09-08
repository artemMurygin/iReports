import { Inject, Injectable } from '@nestjs/common';
import type { UnmatchedEmployeeResponse } from 'ireports-contracts';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';

// Список сотрудников Bitrix, у которых нет ни одной связи ни в одной
// внешней системе — см. сценарий PRD "Администратор портала открывает
// список сотрудников без сопоставления".
@Injectable()
export class ListUnmatchedEmployeesService {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(): Promise<UnmatchedEmployeeResponse[]> {
        return this.repo.findUnmatchedEmployees();
    }
}

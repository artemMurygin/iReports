import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeIdentityResponse } from 'ireports-contracts';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { toEmployeeIdentityResponse } from '../mappers/to-employee-identity-response';

// Карточка сотрудника → его связи с внешними системами (см.
// docs/payroll/prd-payroll-calculation.md, сценарий "Администратор портала
// открывает карточку сотрудника").
@Injectable()
export class ListEmployeeIdentitiesService {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(
        bitrixEmployeeId: number,
    ): Promise<EmployeeIdentityResponse[]> {
        const identities = await this.repo.findByEmployee(bitrixEmployeeId);
        return identities.map(toEmployeeIdentityResponse);
    }
}

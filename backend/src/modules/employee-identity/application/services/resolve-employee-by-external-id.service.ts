import { Inject, Injectable } from '@nestjs/common';
import { EMPLOYEE_IDENTITY_REPOSITORY } from '../ports/employee-identity.port';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import {
    EmployeeIdentityType,
    ExternalSystem,
} from '../../domain/types/employee-identity.types';

// Вход для будущего сборщика контекста расчёта (см. PRD, раздел "Контекст
// расчёта", Фаза 1): по значению, найденному в данных ERP (например,
// RoappOrder.onlineManager — строковый идентификатор типа
// ONLINE_MANAGER_FIELD), находит Bitrix-сотрудника, если связь заведена.
@Injectable()
export class ResolveEmployeeByExternalIdService {
    constructor(
        @Inject(EMPLOYEE_IDENTITY_REPOSITORY)
        private readonly repo: EmployeeIdentityRepositoryPort,
    ) {}

    async execute(
        system: ExternalSystem,
        identifierType: EmployeeIdentityType,
        externalId: string,
    ): Promise<number | null> {
        const identity = await this.repo.findByExternalId(
            system,
            identifierType,
            externalId,
        );
        return identity ? identity.bitrixEmployeeId : null;
    }
}

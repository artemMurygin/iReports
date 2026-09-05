import type { BitrixEmployeeCredentials } from '../../domain/entities/bitrix-employee-credentials.entity';

export interface BitrixEmployeeCredentialsRepositoryPort {
    findByEmployeeId(
        bitrixEmployeeId: number,
    ): Promise<BitrixEmployeeCredentials | null>;
    upsert(entity: BitrixEmployeeCredentials): Promise<void>;
}

export const BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY = Symbol(
    'BITRIX_EMPLOYEE_CREDENTIALS_REPOSITORY',
);

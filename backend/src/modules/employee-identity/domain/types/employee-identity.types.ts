import type { EmployeeIdentityType, ExternalSystem } from 'ireports-contracts';

export type { ExternalSystem, EmployeeIdentityType };

export interface EmployeeIdentityProps {
    bitrixEmployeeId: number;
    system: ExternalSystem;
    identifierType: EmployeeIdentityType;
    externalId: string;
}

export type EmployeeIdentityCreateProps = EmployeeIdentityProps;

export interface EmployeeIdentityUpdateProps {
    identifierType?: EmployeeIdentityType;
    externalId?: string;
}

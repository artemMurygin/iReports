import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';
import {
    BitrixEmployeeSummary,
    EmployeeIdentityRepositoryPort,
} from '../../application/ports/employee-identity.port';
import {
    EmployeeIdentityType,
    ExternalSystem,
} from '../../domain/types/employee-identity.types';
import { EmployeeIdentityMapper } from '../mappers/employee-identity.mapper';

@Injectable()
export class EmployeeIdentityRepository
    extends PrismaRepository
    implements EmployeeIdentityRepositoryPort
{
    private readonly mapper = new EmployeeIdentityMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: EmployeeIdentity): Promise<void> {
        await this.write(entity, (client) =>
            client.employeeIdentity.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async update(entity: EmployeeIdentity): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.employeeIdentity.update({
                where: { id: props.id },
                data: {
                    identifierType: props.identifierType,
                    externalId: props.externalId,
                    updatedAt: props.updatedAt,
                },
            }),
        );
    }

    async delete(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.employeeIdentity.delete({ where: { id } }),
        );
    }

    async findById(id: string): Promise<EmployeeIdentity | null> {
        const record = await this.client.employeeIdentity.findUnique({
            where: { id },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByEmployee(
        bitrixEmployeeId: number,
    ): Promise<EmployeeIdentity[]> {
        const records = await this.client.employeeIdentity.findMany({
            where: { bitrixEmployeeId },
            orderBy: { createdAt: 'asc' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findAll(): Promise<EmployeeIdentity[]> {
        const records = await this.client.employeeIdentity.findMany({
            // Порядок задан явно, чтобы связи приходили уже сгруппированными по
            // сотруднику и группировка на клиенте была стабильной между
            // запросами.
            orderBy: [{ bitrixEmployeeId: 'asc' }, { createdAt: 'asc' }],
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByExternalId(
        system: ExternalSystem,
        identifierType: EmployeeIdentityType,
        externalId: string,
    ): Promise<EmployeeIdentity | null> {
        const record = await this.client.employeeIdentity.findUnique({
            where: {
                system_identifierType_externalId: {
                    system,
                    identifierType,
                    externalId,
                },
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findUnmatchedEmployees(): Promise<BitrixEmployeeSummary[]> {
        const employees = await this.client.bitrixEmployee.findMany({
            where: { identities: { none: {} } },
            orderBy: { id: 'asc' },
        });
        return employees.map((employee) => ({
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            departmentId: employee.departmentId,
        }));
    }
}

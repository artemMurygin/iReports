import { withRequestContext } from '@/shared/testing/with-request-context';
import { ListEmployeeIdentitiesService } from './list-employee-identities.service';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';

describe('ListEmployeeIdentitiesService', () => {
    it('возвращает связи сотрудника, а не других сотрудников', async () => {
        await withRequestContext(async () => {
            const own = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const findByEmployee = jest.fn().mockResolvedValue([own]);
            const repo: EmployeeIdentityRepositoryPort = {
                insert: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                findById: jest.fn(),
                findByEmployee,
                findByExternalId: jest.fn(),
                findUnmatchedEmployees: jest.fn(),
            };
            const service = new ListEmployeeIdentitiesService(repo);

            const result = await service.execute(42);

            expect(findByEmployee).toHaveBeenCalledWith(42);
            expect(result).toEqual([
                expect.objectContaining({
                    bitrixEmployeeId: 42,
                    externalId: '412',
                }),
            ]);
        });
    });
});

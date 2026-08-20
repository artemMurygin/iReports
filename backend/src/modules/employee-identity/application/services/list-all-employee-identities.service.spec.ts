import { withRequestContext } from '@/shared/testing/with-request-context';
import { ListAllEmployeeIdentitiesService } from './list-all-employee-identities.service';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';

describe('ListAllEmployeeIdentitiesService', () => {
    it('отдаёт связи всех сотрудников одним ответом, прогнав их через маппер', async () => {
        await withRequestContext(async () => {
            const roapp = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const moySklad = EmployeeIdentity.create({
                bitrixEmployeeId: 7,
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: 'ms-99',
            });
            const findAll = jest.fn().mockResolvedValue([roapp, moySklad]);
            const repo: EmployeeIdentityRepositoryPort = {
                insert: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                findById: jest.fn(),
                findByEmployee: jest.fn(),
                findAll,
                findByExternalId: jest.fn(),
                findUnmatchedEmployees: jest.fn(),
            };
            const service = new ListAllEmployeeIdentitiesService(repo);

            const result = await service.execute();

            expect(findAll).toHaveBeenCalledTimes(1);
            expect(result).toEqual([
                expect.objectContaining({
                    bitrixEmployeeId: 42,
                    system: 'ROAPP',
                    externalId: '412',
                }),
                expect.objectContaining({
                    bitrixEmployeeId: 7,
                    system: 'MOY_SKLAD',
                    externalId: 'ms-99',
                }),
            ]);
        });
    });
});

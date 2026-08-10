import { ListUnmatchedEmployeesService } from './list-unmatched-employees.service';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';

describe('ListUnmatchedEmployeesService', () => {
    it('отдаёт список сотрудников без связей как есть из репозитория', async () => {
        const unmatched = [
            { id: 1, firstName: 'Иван', lastName: 'Иванов', departmentId: 3 },
        ];
        const findUnmatchedEmployees = jest.fn().mockResolvedValue(unmatched);
        const repo: EmployeeIdentityRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByEmployee: jest.fn(),
            findByExternalId: jest.fn(),
            findUnmatchedEmployees,
        };
        const service = new ListUnmatchedEmployeesService(repo);

        const result = await service.execute();

        expect(result).toBe(unmatched);
    });
});

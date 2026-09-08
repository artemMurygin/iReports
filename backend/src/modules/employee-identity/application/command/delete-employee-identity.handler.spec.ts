import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeleteEmployeeIdentityHandler } from './delete-employee-identity.handler';
import { DeleteEmployeeIdentityCommand } from './delete-employee-identity.command';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';
import { EmployeeIdentityNotFoundException } from '../../domain/exceptions/employee-identity.exception';

describe('DeleteEmployeeIdentityHandler', () => {
    const buildHandler = (found: EmployeeIdentity | null) => {
        const deleteFn = jest.fn().mockResolvedValue(undefined);
        const repo: EmployeeIdentityRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: deleteFn,
            findById: jest.fn().mockResolvedValue(found),
            findByEmployee: jest.fn(),
            findAll: jest.fn(),
            findByExternalId: jest.fn(),
            findUnmatchedEmployees: jest.fn(),
        };
        const handler = new DeleteEmployeeIdentityHandler(repo);
        return { handler, deleteFn };
    };

    it('удаляет существующую связь', async () => {
        await withRequestContext(async () => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const { handler, deleteFn } = buildHandler(identity);

            await handler.execute(
                new DeleteEmployeeIdentityCommand({ identityId: identity.id }),
            );

            expect(deleteFn).toHaveBeenCalledWith(identity.id);
        });
    });

    it('падает NotFound при удалении несуществующей связи', async () => {
        await withRequestContext(async () => {
            const { handler, deleteFn } = buildHandler(null);

            await expect(
                handler.execute(
                    new DeleteEmployeeIdentityCommand({
                        identityId: 'missing',
                    }),
                ),
            ).rejects.toBeInstanceOf(EmployeeIdentityNotFoundException);
            expect(deleteFn).not.toHaveBeenCalled();
        });
    });
});

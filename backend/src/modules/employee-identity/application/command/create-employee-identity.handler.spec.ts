import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateEmployeeIdentityHandler } from './create-employee-identity.handler';
import { CreateEmployeeIdentityCommand } from './create-employee-identity.command';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';
import { EmployeeIdentityAlreadyExistsException } from '../../domain/exceptions/employee-identity.exception';

describe('CreateEmployeeIdentityHandler', () => {
    const buildHandler = (existing: EmployeeIdentity | null = null) => {
        const insert = jest.fn().mockResolvedValue(undefined);
        const findByExternalId = jest.fn().mockResolvedValue(existing);
        const repo: EmployeeIdentityRepositoryPort = {
            insert,
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByEmployee: jest.fn(),
            findAll: jest.fn(),
            findByExternalId,
            findUnmatchedEmployees: jest.fn(),
        };
        const handler = new CreateEmployeeIdentityHandler(repo);
        return { handler, insert, findByExternalId };
    };

    it('создаёт связь и сохраняет её через репозиторий', async () => {
        await withRequestContext(async () => {
            const { handler, insert } = buildHandler();
            const command = new CreateEmployeeIdentityCommand({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });

            const result = await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
            expect(result).toMatchObject({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
        });
    });

    it('отклоняет дубль идентификатора в той же системе', async () => {
        await withRequestContext(async () => {
            const existing = EmployeeIdentity.create({
                bitrixEmployeeId: 7,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const { handler, insert } = buildHandler(existing);
            const command = new CreateEmployeeIdentityCommand({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                EmployeeIdentityAlreadyExistsException,
            );
            expect(insert).not.toHaveBeenCalled();
        });
    });

    it('позволяет завести сотруднику второй идентификатор в той же системе', async () => {
        await withRequestContext(async () => {
            // findByExternalId не находит совпадения для второго
            // идентификатора — это разные пары (system, identifierType, externalId).
            const { handler, insert } = buildHandler(null);
            const command = new CreateEmployeeIdentityCommand({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'Иванов И.И.',
            });

            await handler.execute(command);

            expect(insert).toHaveBeenCalledTimes(1);
        });
    });
});

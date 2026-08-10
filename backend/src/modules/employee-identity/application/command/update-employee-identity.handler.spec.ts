import { withRequestContext } from '@/shared/testing/with-request-context';
import { UpdateEmployeeIdentityHandler } from './update-employee-identity.handler';
import { UpdateEmployeeIdentityCommand } from './update-employee-identity.command';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';
import {
    EmployeeIdentityAlreadyExistsException,
    EmployeeIdentityNotFoundException,
} from '../../domain/exceptions/employee-identity.exception';

describe('UpdateEmployeeIdentityHandler', () => {
    const buildHandler = ({
        found = null as EmployeeIdentity | null,
        clashing = null as EmployeeIdentity | null,
    } = {}) => {
        const update = jest.fn().mockResolvedValue(undefined);
        const findById = jest.fn().mockResolvedValue(found);
        const findByExternalId = jest.fn().mockResolvedValue(clashing);
        const repo: EmployeeIdentityRepositoryPort = {
            insert: jest.fn(),
            update,
            delete: jest.fn(),
            findById,
            findByEmployee: jest.fn(),
            findByExternalId,
            findUnmatchedEmployees: jest.fn(),
        };
        const handler = new UpdateEmployeeIdentityHandler(repo);
        return { handler, update, findById, findByExternalId };
    };

    it('падает NotFound, если связи не существует', async () => {
        await withRequestContext(async () => {
            const { handler } = buildHandler({ found: null });
            const command = new UpdateEmployeeIdentityCommand({
                identityId: 'missing',
                externalId: '999',
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                EmployeeIdentityNotFoundException,
            );
        });
    });

    it('меняет externalId и сохраняет через репозиторий', async () => {
        await withRequestContext(async () => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const { handler, update } = buildHandler({
                found: identity,
                clashing: null,
            });
            const command = new UpdateEmployeeIdentityCommand({
                identityId: identity.id,
                externalId: '999',
            });

            const result = await handler.execute(command);

            expect(result.externalId).toBe('999');
            expect(update).toHaveBeenCalledTimes(1);
        });
    });

    it('отклоняет правку, конфликтующую с чужой связью', async () => {
        await withRequestContext(async () => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const other = EmployeeIdentity.create({
                bitrixEmployeeId: 7,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '999',
            });
            const { handler, update } = buildHandler({
                found: identity,
                clashing: other,
            });
            const command = new UpdateEmployeeIdentityCommand({
                identityId: identity.id,
                externalId: '999',
            });

            await expect(handler.execute(command)).rejects.toBeInstanceOf(
                EmployeeIdentityAlreadyExistsException,
            );
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('не проверяет уникальность заново, если ничего не меняется', async () => {
        await withRequestContext(async () => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            });
            const { handler, findByExternalId } = buildHandler({
                found: identity,
            });
            const command = new UpdateEmployeeIdentityCommand({
                identityId: identity.id,
            });

            await handler.execute(command);

            expect(findByExternalId).not.toHaveBeenCalled();
        });
    });
});

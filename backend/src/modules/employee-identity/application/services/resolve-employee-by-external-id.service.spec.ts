import { withRequestContext } from '@/shared/testing/with-request-context';
import { ResolveEmployeeByExternalIdService } from './resolve-employee-by-external-id.service';
import type { EmployeeIdentityRepositoryPort } from '../ports/employee-identity.port';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';

describe('ResolveEmployeeByExternalIdService', () => {
    const buildService = (found: EmployeeIdentity | null) => {
        const findByExternalId = jest.fn().mockResolvedValue(found);
        const repo: EmployeeIdentityRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByEmployee: jest.fn(),
            findByExternalId,
            findUnmatchedEmployees: jest.fn(),
        };
        return {
            service: new ResolveEmployeeByExternalIdService(repo),
            findByExternalId,
        };
    };

    it('резолвит заказ RemOnline со строковым «онлайн-менеджером» в нужного Bitrix-сотрудника', async () => {
        await withRequestContext(async () => {
            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'Иванов И.И.',
            });
            const { service, findByExternalId } = buildService(identity);

            // RoappOrder.onlineManager === 'Иванов И.И.' — сырое строковое
            // поле заказа RemOnline, без ссылки на сотрудника.
            const resolvedEmployeeId = await service.execute(
                'ROAPP',
                'ONLINE_MANAGER_FIELD',
                'Иванов И.И.',
            );

            expect(resolvedEmployeeId).toBe(42);
            expect(findByExternalId).toHaveBeenCalledWith(
                'ROAPP',
                'ONLINE_MANAGER_FIELD',
                'Иванов И.И.',
            );
        });
    });

    it('возвращает null, если связь не заведена (значение поля не сопоставлено)', async () => {
        await withRequestContext(async () => {
            const { service } = buildService(null);

            const resolvedEmployeeId = await service.execute(
                'ROAPP',
                'ONLINE_MANAGER_FIELD',
                'Незнакомый Менеджер',
            );

            expect(resolvedEmployeeId).toBeNull();
        });
    });
});

import { EmployeeIdentityMapper } from './employee-identity.mapper';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { EmployeeIdentity } from '../../domain/entities/employee-identity.entity';

describe('EmployeeIdentityMapper', () => {
    const mapper = new EmployeeIdentityMapper();

    it('toDomain восстанавливает сущность из записи БД', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'identity-1',
            bitrixEmployeeId: 42,
            system: 'ROAPP',
            identifierType: 'EMPLOYEE_ID',
            externalId: '412',
            createdAt: now,
            updatedAt: now,
        });

        expect(entity).toBeInstanceOf(EmployeeIdentity);
        expect(entity.id).toBe('identity-1');
        expect(entity.bitrixEmployeeId).toBe(42);
        expect(entity.system).toBe('ROAPP');
        expect(entity.identifierType).toBe('EMPLOYEE_ID');
        expect(entity.externalId).toBe('412');
    });

    it('toPersistence сериализует сущность через connect на BitrixEmployee', () => {
        const entity = withRequestContext(() =>
            EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: 'ms-7',
            }),
        );

        const record = mapper.toPersistence(entity);

        expect(record).toMatchObject({
            id: entity.id,
            bitrixEmployee: { connect: { id: 42 } },
            system: 'MOY_SKLAD',
            identifierType: 'EMPLOYEE_ID',
            externalId: 'ms-7',
        });
    });

    it('toDomain → toPersistence не теряет и не искажает данные', () => {
        const now = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            id: 'identity-2',
            bitrixEmployeeId: 7,
            system: 'ROAPP',
            identifierType: 'ONLINE_MANAGER_FIELD',
            externalId: 'Иванов И.И.',
            createdAt: now,
            updatedAt: now,
        });

        const record = mapper.toPersistence(entity);

        expect(record).toMatchObject({
            id: 'identity-2',
            bitrixEmployee: { connect: { id: 7 } },
            system: 'ROAPP',
            identifierType: 'ONLINE_MANAGER_FIELD',
            externalId: 'Иванов И.И.',
        });
    });
});

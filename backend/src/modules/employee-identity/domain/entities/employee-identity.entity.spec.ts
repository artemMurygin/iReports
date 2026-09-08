import { withRequestContext } from '@/shared/testing/with-request-context';
import { EmployeeIdentity } from './employee-identity.entity';

describe('EmployeeIdentity', () => {
    it('создаёт связь сотрудника с внешней системой', () => {
        const identity = withRequestContext(() =>
            EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            }),
        );

        expect(identity.bitrixEmployeeId).toBe(42);
        expect(identity.system).toBe('ROAPP');
        expect(identity.identifierType).toBe('EMPLOYEE_ID');
        expect(identity.externalId).toBe('412');
        expect(identity.id).toEqual(expect.any(String));
    });

    it('отклоняет создание с пустым внешним идентификатором', () => {
        expect(() =>
            withRequestContext(() =>
                EmployeeIdentity.create({
                    bitrixEmployeeId: 42,
                    system: 'ROAPP',
                    identifierType: 'ONLINE_MANAGER_FIELD',
                    externalId: '   ',
                }),
            ),
        ).toThrow();
    });

    it('update() меняет тип идентификатора и внешний ID, но не сотрудника/систему', () => {
        const identity = withRequestContext(() =>
            EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            }),
        );

        withRequestContext(() =>
            identity.update({
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'Иванов И.И.',
            }),
        );

        expect(identity.bitrixEmployeeId).toBe(42);
        expect(identity.system).toBe('ROAPP');
        expect(identity.identifierType).toBe('ONLINE_MANAGER_FIELD');
        expect(identity.externalId).toBe('Иванов И.И.');
    });

    it('update() отклоняет правку в пустую строку', () => {
        const identity = withRequestContext(() =>
            EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            }),
        );

        expect(() =>
            withRequestContext(() => identity.update({ externalId: '' })),
        ).toThrow();
    });

    it('сотруднику можно завести несколько идентификаторов в одной системе (разные записи)', () => {
        const byId = withRequestContext(() =>
            EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '412',
            }),
        );
        const byOnlineManagerField = withRequestContext(() =>
            EmployeeIdentity.create({
                bitrixEmployeeId: 42,
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'Иванов И.И.',
            }),
        );

        expect(byId.bitrixEmployeeId).toBe(
            byOnlineManagerField.bitrixEmployeeId,
        );
        expect(byId.id).not.toBe(byOnlineManagerField.id);
    });
});

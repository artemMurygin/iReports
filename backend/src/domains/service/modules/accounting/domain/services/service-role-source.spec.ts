import {
    employeeMatchesServiceRole,
    resolveServiceRoleSource,
    ServiceOrderRoleFields,
} from './service-role-source';
import type { CalculationEmployee } from '@/shared/domain/calculation-context';

const buildFields = (
    overrides: Partial<ServiceOrderRoleFields> = {},
): ServiceOrderRoleFields => ({
    engineerId: 42,
    managerId: 7,
    createdById: 3,
    closedById: 9,
    onlineManager: 'ivan.petrov',
    ...overrides,
});

const employeeWith = (
    identities: CalculationEmployee['identities'],
): CalculationEmployee => ({ id: 1, identities });

describe('resolveServiceRoleSource', () => {
    it('ENGINEER резолвится к engineerId позиции', () => {
        expect(resolveServiceRoleSource('ENGINEER')).toEqual({
            kind: 'ENGINEER_ID',
        });
    });

    it('ONLINE_MANAGER резолвится к строковому полю', () => {
        expect(resolveServiceRoleSource('ONLINE_MANAGER')).toEqual({
            kind: 'ONLINE_MANAGER_FIELD',
        });
    });

    it('OFFLINE_MANAGER и ORDER_MANAGER резолвятся к managerId', () => {
        expect(resolveServiceRoleSource('OFFLINE_MANAGER')).toEqual({
            kind: 'ORDER_EMPLOYEE_FIELD',
            field: 'managerId',
        });
        expect(resolveServiceRoleSource('ORDER_MANAGER')).toEqual({
            kind: 'ORDER_EMPLOYEE_FIELD',
            field: 'managerId',
        });
    });

    it('CREATED_BY и CLOSED_BY резолвятся к своим полям', () => {
        expect(resolveServiceRoleSource('CREATED_BY')).toEqual({
            kind: 'ORDER_EMPLOYEE_FIELD',
            field: 'createdById',
        });
        expect(resolveServiceRoleSource('CLOSED_BY')).toEqual({
            kind: 'ORDER_EMPLOYEE_FIELD',
            field: 'closedById',
        });
    });
});

describe('employeeMatchesServiceRole', () => {
    it('ENGINEER — совпадает по EmployeeIdentity типа EMPLOYEE_ID системы ROAPP', () => {
        const employee = employeeWith([
            {
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: '42',
            },
        ]);

        expect(
            employeeMatchesServiceRole(employee, 'ENGINEER', buildFields()),
        ).toBe(true);
        expect(
            employeeMatchesServiceRole(
                employee,
                'ENGINEER',
                buildFields({ engineerId: 999 }),
            ),
        ).toBe(false);
    });

    it('ONLINE_MANAGER — совпадает по EmployeeIdentity типа ONLINE_MANAGER_FIELD', () => {
        const employee = employeeWith([
            {
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'ivan.petrov',
            },
        ]);

        expect(
            employeeMatchesServiceRole(
                employee,
                'ONLINE_MANAGER',
                buildFields(),
            ),
        ).toBe(true);
        // EMPLOYEE_ID тем же числом, что managerId — не должен засчитаться
        // за ONLINE_MANAGER, идентификаторы разных типов не взаимозаменяемы.
        const wrongType = employeeWith([
            {
                system: 'ROAPP',
                identifierType: 'EMPLOYEE_ID',
                externalId: 'ivan.petrov',
            },
        ]);
        expect(
            employeeMatchesServiceRole(
                wrongType,
                'ONLINE_MANAGER',
                buildFields(),
            ),
        ).toBe(false);
    });

    it('ONLINE_MANAGER — не совпадает, если поле заказа пустое', () => {
        const employee = employeeWith([
            {
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'ivan.petrov',
            },
        ]);

        expect(
            employeeMatchesServiceRole(
                employee,
                'ONLINE_MANAGER',
                buildFields({ onlineManager: null }),
            ),
        ).toBe(false);
    });

    it('CLOSED_BY — не совпадает, если заказ ещё не закрыт (closedById = null)', () => {
        const employee = employeeWith([
            { system: 'ROAPP', identifierType: 'EMPLOYEE_ID', externalId: '9' },
        ]);

        expect(
            employeeMatchesServiceRole(
                employee,
                'CLOSED_BY',
                buildFields({ closedById: null }),
            ),
        ).toBe(false);
    });

    it('MOY_SKLAD-идентификатор с тем же числом не засчитывается для ролей RoApp', () => {
        const employee = employeeWith([
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: '42',
            },
        ]);

        expect(
            employeeMatchesServiceRole(employee, 'ENGINEER', buildFields()),
        ).toBe(false);
    });
});

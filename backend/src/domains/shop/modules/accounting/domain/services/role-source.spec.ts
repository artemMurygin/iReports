import {
    employeeMatchesShopDemandRole,
    employeeMatchesShopPurchaserRole,
    resolveShopRoleSource,
} from './role-source';
import type { CalculationEmployee } from '@/shared/domain/calculation-context';

const employee = (
    identities: CalculationEmployee['identities'],
): CalculationEmployee => ({ id: 1, identities });

describe('resolveShopRoleSource', () => {
    it('ONLINE_MANAGER/OFFLINE_MANAGER — уровень отгрузки', () => {
        expect(resolveShopRoleSource('ONLINE_MANAGER')).toEqual({
            kind: 'DEMAND_MANAGER_FIELD',
            field: 'onlineManagerId',
        });
        expect(resolveShopRoleSource('OFFLINE_MANAGER')).toEqual({
            kind: 'DEMAND_MANAGER_FIELD',
            field: 'offlineManagerId',
        });
    });

    it('ONLINE_PURCHASER/OFFLINE_PURCHASER — уровень товарной позиции', () => {
        expect(resolveShopRoleSource('ONLINE_PURCHASER')).toEqual({
            kind: 'POSITION_PURCHASER_FIELD',
            field: 'onlinePurchaserId',
            identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
        });
        expect(resolveShopRoleSource('OFFLINE_PURCHASER')).toEqual({
            kind: 'POSITION_PURCHASER_FIELD',
            field: 'offlinePurchaserId',
            identifierType: 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
        });
    });

    it('бросает для ролей, не относящихся к shop (например, ENGINEER сервиса)', () => {
        expect(() => resolveShopRoleSource('ENGINEER')).toThrow();
    });
});

describe('employeeMatchesShopDemandRole', () => {
    it('совпадает по EmployeeIdentity MOY_SKLAD/EMPLOYEE_ID', () => {
        const emp = employee([
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: 'ms-1',
            },
        ]);

        expect(
            employeeMatchesShopDemandRole(emp, 'ONLINE_MANAGER', {
                onlineManagerId: 'ms-1',
                offlineManagerId: null,
            }),
        ).toBe(true);
        expect(
            employeeMatchesShopDemandRole(emp, 'OFFLINE_MANAGER', {
                onlineManagerId: 'ms-1',
                offlineManagerId: null,
            }),
        ).toBe(false);
    });

    it('поле null — не совпадает', () => {
        const emp = employee([
            {
                system: 'MOY_SKLAD',
                identifierType: 'EMPLOYEE_ID',
                externalId: 'ms-1',
            },
        ]);

        expect(
            employeeMatchesShopDemandRole(emp, 'ONLINE_MANAGER', {
                onlineManagerId: null,
                offlineManagerId: null,
            }),
        ).toBe(false);
    });

    it('бросает для ролей закупщика (уровень позиции, не отгрузки)', () => {
        const emp = employee([]);
        expect(() =>
            employeeMatchesShopDemandRole(emp, 'ONLINE_PURCHASER', {
                onlineManagerId: null,
                offlineManagerId: null,
            }),
        ).toThrow();
    });
});

describe('employeeMatchesShopPurchaserRole', () => {
    it('совпадает по EmployeeIdentity типа MOY_SKLAD_ONLINE_PURCHASER_FIELD', () => {
        const emp = employee([
            {
                system: 'MOY_SKLAD',
                identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                externalId: 'purchaser-name',
            },
        ]);

        expect(
            employeeMatchesShopPurchaserRole(emp, 'ONLINE_PURCHASER', {
                onlinePurchaserId: 'purchaser-name',
                offlinePurchaserId: null,
            }),
        ).toBe(true);
    });

    it('бросает для ролей менеджера (уровень отгрузки, не позиции)', () => {
        const emp = employee([]);
        expect(() =>
            employeeMatchesShopPurchaserRole(emp, 'ONLINE_MANAGER', {
                onlinePurchaserId: null,
                offlinePurchaserId: null,
            }),
        ).toThrow();
    });
});

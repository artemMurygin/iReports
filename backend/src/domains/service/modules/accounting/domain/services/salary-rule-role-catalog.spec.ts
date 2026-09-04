import { listSalaryRuleTypes } from './salary-rule-role-catalog';

describe('listSalaryRuleTypes', () => {
    it('возвращает все зарегистрированные типы правил сервиса с ролями', () => {
        const types = listSalaryRuleTypes();

        expect(types.map((t) => t.type).sort()).toEqual([
            'OrderPayed',
            'PayPerHour',
            'ServiceCompleted',
        ]);
        for (const entry of types) {
            expect(entry.allowedRoles).toEqual(
                expect.arrayContaining(['ENGINEER', 'ONLINE_MANAGER']),
            );
            expect(entry.allowedRoles.length).toBe(4);
        }
    });
});

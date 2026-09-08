import { planEmployeeIdentityMigration } from './plan-employee-identity-migration';

describe('planEmployeeIdentityMigration', () => {
    it('переносит ровно столько связей, сколько непустых значений в исходных полях', () => {
        const employees = [
            // Все три поля заполнены — 3 связи.
            {
                id: 1,
                roappId: 412,
                moySkladId: 'ms-1',
                roappOnlineName: 'Иванов И.И.',
            },
            // Только roappId — 1 связь.
            { id: 2, roappId: 500, moySkladId: null, roappOnlineName: null },
            // Ничего не заполнено — 0 связей.
            { id: 3, roappId: null, moySkladId: null, roappOnlineName: null },
        ];

        const plan = planEmployeeIdentityMigration(employees);

        expect(plan).toHaveLength(4);
    });

    it('корректно сопоставляет систему и тип идентификатора для каждого поля', () => {
        const plan = planEmployeeIdentityMigration([
            {
                id: 1,
                roappId: 412,
                moySkladId: 'ms-1',
                roappOnlineName: 'Иванов И.И.',
            },
        ]);

        expect(plan).toEqual(
            expect.arrayContaining([
                {
                    bitrixEmployeeId: 1,
                    system: 'ROAPP',
                    identifierType: 'EMPLOYEE_ID',
                    externalId: '412',
                },
                {
                    bitrixEmployeeId: 1,
                    system: 'MOY_SKLAD',
                    identifierType: 'EMPLOYEE_ID',
                    externalId: 'ms-1',
                },
                {
                    bitrixEmployeeId: 1,
                    system: 'ROAPP',
                    identifierType: 'ONLINE_MANAGER_FIELD',
                    externalId: 'Иванов И.И.',
                },
            ]),
        );
    });

    it('идемпотентна: уже перенесённые связи не дублируются при повторном запуске', () => {
        const employees = [
            {
                id: 1,
                roappId: 412,
                moySkladId: null,
                roappOnlineName: 'Иванов И.И.',
            },
        ];
        const alreadyMigrated = [
            {
                system: 'ROAPP' as const,
                identifierType: 'EMPLOYEE_ID' as const,
                externalId: '412',
            },
        ];

        const plan = planEmployeeIdentityMigration(employees, alreadyMigrated);

        expect(plan).toEqual([
            {
                bitrixEmployeeId: 1,
                system: 'ROAPP',
                identifierType: 'ONLINE_MANAGER_FIELD',
                externalId: 'Иванов И.И.',
            },
        ]);
    });

    it('пустой список сотрудников даёт пустой план', () => {
        expect(planEmployeeIdentityMigration([])).toEqual([]);
    });
});

import { listSalaryRuleTypes } from './salary-rule-role-catalog';

describe('listSalaryRuleTypes', () => {
    it('возвращает все зарегистрированные типы правил сервиса с ролями', () => {
        const types = listSalaryRuleTypes();

        // Раздел 10 tasks.md (add-task-based-salary-rule) — 4 типа вместо 3
        // после регистрации TaskCompletion в salaryRuleRegistry. Раздел 12
        // tasks.md (add-department-head-salary-rules) — ещё 3 новых вида
        // уровня отдела/направления после их регистрации в этом же раунде.
        expect(types.map((t) => t.type).sort()).toEqual([
            'DepartmentPercent',
            'DepartmentPlanBonus',
            'DepartmentTurnoverBonus',
            'OrderPayed',
            'PayPerHour',
            'ServiceCompleted',
            'TaskCompletion',
        ]);
        for (const entry of types) {
            expect(entry.allowedRoles).toEqual(
                expect.arrayContaining([
                    'ENGINEER',
                    'ONLINE_MANAGER',
                    // FR1 add-department-head-salary-rules — «руководитель направления» доступен
                    // как опция роли для 3 новых видов правил (design.md Decision 4); каталог не
                    // различает типы правил, поэтому роль видна и у существующих 4 типов.
                    'DEPARTMENT_HEAD',
                ]),
            );
            expect(entry.allowedRoles.length).toBe(5);
        }
    });
});

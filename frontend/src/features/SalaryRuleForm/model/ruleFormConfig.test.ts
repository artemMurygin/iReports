import { describe, expect, it } from 'vitest'

import { restrictRuleFormConfigToTarget, type RuleFormConfig } from './ruleFormConfig.ts'

/**
 * Requirement "Создание правила-задачи только в схеме на сотрудника" (change
 * salary-rule-bitrix-task, spec.md) — `TaskCompleted` не должен предлагаться в селекте типа
 * правила, когда цель схемы — отдел. `restrictRuleFormConfigToTarget` — единственное место, где эта
 * фильтрация происходит (см. её собственный комментарий); тест не рендерит форму (в проекте нет
 * тестового раннера для React-компонентов, только vitest для чистой логики, см.
 * `service/model/ruleFormSchema.test.ts`), а проверяет именно то, что реально управляет
 * `RuleFormCardFields`'s `<Select>`-опциями — `config.ruleTypeOrder`.
 */
const config: RuleFormConfig = {
    ruleTypeOrder: ['PayPerHour', 'ServiceCompleted', 'OrderPayed', 'TaskCompleted'],
    ruleTypeLabels: {},
    awardOptionsByType: {},
    salaryBasisOptions: [],
    categoryRuleTypes: [],
    orderTypeRuleTypes: [],
}

describe('restrictRuleFormConfigToTarget', () => {
    it('drops TaskCompleted from ruleTypeOrder when the schema target is a department', () => {
        const restricted = restrictRuleFormConfigToTarget(config, 'Department')
        expect(restricted.ruleTypeOrder).toEqual(['PayPerHour', 'ServiceCompleted', 'OrderPayed'])
    })

    it('keeps TaskCompleted when the schema target is an employee', () => {
        const restricted = restrictRuleFormConfigToTarget(config, 'Employee')
        expect(restricted.ruleTypeOrder).toEqual(config.ruleTypeOrder)
    })

    it('keeps TaskCompleted when the target is not known yet (null — schema still loading)', () => {
        const restricted = restrictRuleFormConfigToTarget(config, null)
        expect(restricted.ruleTypeOrder).toContain('TaskCompleted')
    })

    it('does not mutate the original config', () => {
        restrictRuleFormConfigToTarget(config, 'Department')
        expect(config.ruleTypeOrder).toContain('TaskCompleted')
    })
})

import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSalaryRulePanel } from './useSalaryRulePanel.ts'

// add-task-salary-rule-links-comments, tasks.md группа 30.1 — чистый стейт-хук без побочных
// запросов (по образцу `features/SalaryRuleForm/model/useTaskLinkPanels.ts`). `openRuleRef` —
// уже готовый объект пропсов `SalaryRuleDetailsPanelProps` без `onClose` (`{ruleId, direction,
// open}`), рассчитанный на спред в `<SalaryRuleDetailsPanel {...openRuleRef} onClose={closeRule} />`
// (architecture.md: "SalaryRuleDetailsPanel с текущим openRuleRef") — `ruleId`/`direction`
// разведены с `open` именно так, как того требует `SalaryRuleDetailsPanel` (см. её JSDoc: не
// теряет последнее правило при закрытии, пока идёт slide-out анимация `SidePanel`).
describe('useSalaryRulePanel', () => {
    it('starts closed, with no rule referenced', () => {
        const { result } = renderHook(() => useSalaryRulePanel())

        expect(result.current.openRuleRef.open).toBe(false)
        expect(result.current.openRuleRef.ruleId).toBeNull()
    })

    it('openRule({ruleId, direction}) opens the panel with that reference', () => {
        const { result } = renderHook(() => useSalaryRulePanel())

        act(() => result.current.openRule({ ruleId: 'rule-1', direction: 'service' }))

        expect(result.current.openRuleRef).toEqual({ ruleId: 'rule-1', direction: 'service', open: true })
    })

    it('closeRule() closes the panel but keeps the last ruleId/direction (SidePanel slide-out keeps content visible)', () => {
        const { result } = renderHook(() => useSalaryRulePanel())

        act(() => result.current.openRule({ ruleId: 'rule-1', direction: 'shop' }))
        act(() => result.current.closeRule())

        expect(result.current.openRuleRef).toEqual({ ruleId: 'rule-1', direction: 'shop', open: false })
    })

    it('opening a second rule while one is already open switches the reference', () => {
        const { result } = renderHook(() => useSalaryRulePanel())

        act(() => result.current.openRule({ ruleId: 'rule-1', direction: 'service' }))
        act(() => result.current.openRule({ ruleId: 'rule-2', direction: 'shop' }))

        expect(result.current.openRuleRef).toEqual({ ruleId: 'rule-2', direction: 'shop', open: true })
    })

    it('performs no network requests of its own — plain useState only', () => {
        // no axios mock is set up in this file at all; if the hook attempted a request, the real
        // axios instance would reject on the missing base URL / network in jsdom and surface as
        // an unhandled rejection — reaching here at all covers that intent.
        const { result } = renderHook(() => useSalaryRulePanel())

        act(() => result.current.openRule({ ruleId: 'rule-1', direction: 'service' }))

        expect(result.current.openRuleRef.ruleId).toBe('rule-1')
    })
})

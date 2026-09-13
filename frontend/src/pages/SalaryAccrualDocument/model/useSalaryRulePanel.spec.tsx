import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useSalaryRulePanel } from './useSalaryRulePanel.ts'

// Собственная копия `pages/Tasks/model/useSalaryRulePanel.spec.tsx` для этой страницы (кросс-
// страничный импорт запрещён, паттерн копируется вместе с хуком) — тот же контракт: чистый
// стейт-хук без сетевых запросов, `openRuleRef` уже разведён под спред в `SalaryRuleDetailsPanel`.
describe('useSalaryRulePanel (SalaryAccrualDocument)', () => {
    it('starts closed, with no rule referenced', () => {
        const { result } = renderHook(() => useSalaryRulePanel())

        expect(result.current.openRuleRef.open).toBe(false)
        expect(result.current.openRuleRef.ruleId).toBeNull()
    })

    it('openRule({ruleId, direction}) opens the panel with that reference', () => {
        const { result } = renderHook(() => useSalaryRulePanel())

        act(() => result.current.openRule({ ruleId: 'rule-1', direction: 'shop' }))

        expect(result.current.openRuleRef).toEqual({ ruleId: 'rule-1', direction: 'shop', open: true })
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
})

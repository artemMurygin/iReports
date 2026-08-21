import { describe, expect, it } from 'vitest'

import { resolveRoleStyle } from './rolePresentation.ts'

describe('resolveRoleStyle', () => {
    it('resolves one of the four legend roles to its own colour/glyph', () => {
        expect(resolveRoleStyle('ENGINEER')).toEqual({
            label: 'Инженер',
            glyph: 'И',
            bgClassName: 'bg-brand-soft',
            textClassName: 'text-ok-ink',
        })
    })

    it('falls back to a neutral style with «Без роли» for null', () => {
        expect(resolveRoleStyle(null)).toEqual({
            label: 'Без роли',
            glyph: '—',
            bgClassName: 'bg-canvas',
            textClassName: 'text-ink-faint',
        })
    })

    it('falls back to a neutral style with the shared label for a role outside the legend', () => {
        const style = resolveRoleStyle('ORDER_MANAGER')
        expect(style.bgClassName).toBe('bg-canvas')
        expect(style.textClassName).toBe('text-ink-faint')
        expect(style.label).toBe('Менеджер заказов')
    })
})

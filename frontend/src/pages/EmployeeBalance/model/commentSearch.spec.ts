import { describe, expect, it } from 'vitest'

import { matchesCommentSearch } from './commentSearch.ts'

describe('matchesCommentSearch', () => {
    it('matches everything when the search is empty', () => {
        expect(matchesCommentSearch({ comment: null }, '')).toBe(true)
        expect(matchesCommentSearch({ comment: 'Аванс за июль' }, '   ')).toBe(true)
    })

    it('matches a case-insensitive substring of the comment', () => {
        expect(matchesCommentSearch({ comment: 'Аванс за первую половину августа' }, 'ПОЛОВИНУ')).toBe(true)
        expect(matchesCommentSearch({ comment: 'Аванс за первую половину августа' }, 'зарплата')).toBe(false)
    })

    it('never matches a null comment against a non-empty search', () => {
        expect(matchesCommentSearch({ comment: null }, 'аванс')).toBe(false)
    })

    it('trims surrounding whitespace from the search term', () => {
        expect(matchesCommentSearch({ comment: 'Отпуск с 15 августа' }, '  отпуск  ')).toBe(true)
    })
})

// Implements FR6, FR12 of sheets-app-redesign: HTTP code -> banner text mapping for МойСклад.
import { describe, expect, it } from 'vitest'
import { GasHttpError } from '@/shared/gas/types'
import { parseMoySkladError } from './moySkladErrors'

const failed = (code: number, tail = '') => new Error(`Request failed for https://n8n returned code ${code}.${tail}`)

describe('parseMoySkladError', () => {
    it.each([
        [400, 'Некорректный запрос · проверьте данные в листе'],
        [401, 'Нет доступа · проверьте токен интеграции'],
        [403, 'Недостаточно прав для этой операции'],
        [429, 'Слишком много запросов · повторите через минуту'],
        [504, 'Сервер не успел ответить · операция могла выполниться, проверьте результат в МойСклад'],
        [503, 'Сервис МойСклад временно недоступен · повторите позже'],
    ])('FR6: maps %i', (code, detail) => {
        expect(parseMoySkladError(failed(code))).toEqual({
            code: String(code),
            title: `МойСклад ответил ${code}`,
            detail,
        })
    })

    it('FR6: takes the detail from the response body for an unlisted code', () => {
        const err = parseMoySkladError(failed(418, ' Truncated server response: я чайник'))
        expect(err).toMatchObject({ code: '418', detail: 'я чайник' })
    })

    it('FR6: falls back to a generic detail when there is no body', () => {
        expect(parseMoySkladError(failed(418)).detail).toBe('Неожиданный ответ сервиса')
    })

    it('FR6: recognizes a network failure', () => {
        expect(parseMoySkladError(new Error('Failed to fetch'))).toEqual({
            code: 'сети',
            title: 'Нет связи с МойСклад',
            detail: 'Проверьте подключение и повторите',
        })
    })

    it('keeps the raw message when no code is present', () => {
        expect(parseMoySkladError(new Error('Что-то пошло не так'))).toMatchObject({ detail: 'Что-то пошло не так' })
    })

    // FR12: the code arrives structurally from the Apps Script webhook.
    it('FR12: reads the code of a GasHttpError without parsing text', () => {
        expect(parseMoySkladError(new GasHttpError(429, 'Too Many'))).toEqual({
            code: '429',
            title: 'МойСклад ответил 429',
            detail: 'Слишком много запросов · повторите через минуту',
        })
    })

    it('FR12: takes the detail of an unlisted GasHttpError from its message', () => {
        expect(parseMoySkladError(new GasHttpError(418, 'я чайник'))).toMatchObject({ code: '418', detail: 'я чайник' })
    })
})

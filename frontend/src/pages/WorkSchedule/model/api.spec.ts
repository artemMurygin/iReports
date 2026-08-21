import { describe, expect, it } from 'vitest'

import { api, WORK_SCHEDULE_QUERY_KEY_PREFIX } from './api.ts'

// Регрессионный тест на инвалидацию месяца после сохранения дня (Фаза 7, «Когда готово»:
// «изменение ячейки … пересчитывает итог часов сотрудника, счётчик «Человек в смене» и общий фонд
// часов»). Сам пересчёт делает бэкенд при рефетче — фронту достаточно правильно попасть по
// `queryKey` месяца префиксом; если кто-то переименует префикс в одном месте и забудет про
// другое, `invalidateQueries({ queryKey: WORK_SCHEDULE_QUERY_KEY_PREFIX })` в
// `useSaveWorkScheduleEntry.ts` молча перестанет матчить месячный запрос, и этот тест это поймает.
describe('WORK_SCHEDULE_QUERY_KEY_PREFIX wiring', () => {
    it('is a prefix of getMonthlySchedule’s queryKey', () => {
        const { queryKey } = api.getMonthlySchedule('2026-08', null)
        expect(queryKey.slice(0, WORK_SCHEDULE_QUERY_KEY_PREFIX.length)).toEqual([...WORK_SCHEDULE_QUERY_KEY_PREFIX])
    })

    it('stays a prefix regardless of month/department', () => {
        const { queryKey } = api.getMonthlySchedule('2027-01', 42)
        expect(queryKey.slice(0, WORK_SCHEDULE_QUERY_KEY_PREFIX.length)).toEqual([...WORK_SCHEDULE_QUERY_KEY_PREFIX])
    })
})

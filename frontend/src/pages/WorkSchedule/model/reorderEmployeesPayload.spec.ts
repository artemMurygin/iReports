import { describe, expect, it } from 'vitest'

import { buildReorderPayload } from './reorderEmployeesPayload.ts'

describe('buildReorderPayload', () => {
    it('переставляет видимое подмножество внутри его же слотов, не трогая остальных сотрудников', () => {
        // Полный порядок компании: A(0) B(1) C(2) D(3) E(4). Видимое подмножество (например,
        // один отфильтрованный отдел) — B и D, слоты 1 и 3. Пользователь тащит D перед B.
        const fullOrderIds = [10, 20, 30, 40, 50] // A B C D E
        const newVisibleOrderIds = [40, 20] // D, B

        const items = buildReorderPayload(fullOrderIds, newVisibleOrderIds)

        // D занимает слот 1 (был у B), B — слот 3 (был у D); A/C/E вообще не упомянуты — их
        // текущий order на бэкенде не меняется.
        expect(items).toEqual([
            { employeeId: 40, order: 1 },
            { employeeId: 20, order: 3 },
        ])
    })

    it('без фильтра (видимое подмножество = весь справочник) даёт обычную сквозную нумерацию 0..N-1', () => {
        const fullOrderIds = [1, 2, 3]
        const newVisibleOrderIds = [3, 1, 2]

        expect(buildReorderPayload(fullOrderIds, newVisibleOrderIds)).toEqual([
            { employeeId: 3, order: 0 },
            { employeeId: 1, order: 1 },
            { employeeId: 2, order: 2 },
        ])
    })

    it('сохраняет одного сотрудника на его текущем слоте, если порядок не менялся', () => {
        const fullOrderIds = [1, 2, 3]
        expect(buildReorderPayload(fullOrderIds, [2])).toEqual([{ employeeId: 2, order: 1 }])
    })

    it('пропускает сотрудника видимого набора, отсутствующего в полном справочнике (не рассинхронизирован — защитный кейс)', () => {
        const fullOrderIds = [1, 2]
        // 999 нет в fullOrderIds — не должен попасть в payload и не должен сломать остальных.
        const items = buildReorderPayload(fullOrderIds, [999, 1, 2])

        expect(items).toEqual([
            { employeeId: 1, order: 0 },
            { employeeId: 2, order: 1 },
        ])
    })

    it('возвращает пустой список для пустого видимого набора', () => {
        expect(buildReorderPayload([1, 2, 3], [])).toEqual([])
    })
})

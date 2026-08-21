import type { WorkScheduleShiftResponse } from 'ireports-contracts'

/** Знаменатель заголовка «На смене · N из M» (узел `A5SbT` -> `Section На смене` -> `Title`) —
 * сумма пришедших на смену и всех сгруппированных по причине отсутствующих. Бэкенд гарантирует,
 * что это равно числу сотрудников отдела (ENDPOINTS.md, «Когда готово» Фазы 4: "Сумма onShift +
 * всех notOnShift[].employees равна числу сотрудников отдела"), поэтому фронту достаточно сложить
 * то, что уже пришло в ответе, а не запрашивать список сотрудников отдельно. */
export function totalEmployeesOfShift(shift: Pick<WorkScheduleShiftResponse, 'onShift' | 'notOnShift'>): number {
    const absentCount = shift.notOnShift.reduce((sum, group) => sum + group.employees.length, 0)
    return shift.onShift.length + absentCount
}

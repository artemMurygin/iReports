import type { ReorderEmployeesItem } from 'ireports-contracts'

/**
 * Строит payload для `PATCH .../employees/order` (docs/employee-ordering-and-salary-filter,
 * Фаза 1) из drag-n-drop на странице «График работы» — где таблица чаще всего показывает
 * сотрудников ОДНОГО отдела (дефолт `useWorkSchedulePage` — «Розница»), а не весь справочник, но
 * порядок сотрудников в системе ГЛОБАЛЬНЫЙ (PRD, "Не в скоупе": "разный порядок для разных
 * отделов"). Наивная нумерация видимого подмножества с нуля столкнула бы его `order`-слоты с
 * сотрудниками других отделов (та же ловушка, что `EditPlanModal`'s `useEditPlanForm` уже
 * задокументировал как "known limitation" для реордера ПОДМНОЖЕСТВА строк — здесь же подмножество
 * является дефолтным сценарием использования, а не редким кейсом, поэтому эта функция решает её,
 * а не просто документирует).
 *
 * Вместо этого сотрудники видимого подмножества переставляются МЕЖДУ СОБОЙ внутри своих же
 * позиций в `fullOrderIds` (id ВСЕХ сотрудников компании в их текущем известном порядке —
 * `features/TargetDirectory`'s `useEmployees()`, без фильтра по отделу): позиции (индексы),
 * которые видимые сотрудники занимали в `fullOrderIds` ДО перетаскивания, сохраняются как единый
 * набор «слотов», и `newVisibleOrderIds` (тот же набор id, но в НОВОМ, только что перетащенном
 * порядке) построчно заполняет эти слоты по возрастанию. Все сотрудники, не входящие в видимое
 * подмножество, вообще не попадают в payload — их текущий `order` на бэкенде не трогается.
 *
 * `EmployeeResponse` (contracts/commands/directory.ts) намеренно не отдаёт сам числовой `order` —
 * поэтому в качестве значения `order` каждому переставленному сотруднику присваивается тот же
 * индекс (0..N-1), который его слот занимал в `fullOrderIds`: раз меняется содержимое только
 * слотов видимого подмножества, а сами позиции этих слотов среди всех сотрудников компании не
 * меняются, эта нумерация корректно отражает итоговый относительный порядок.
 */
export function buildReorderPayload(
    fullOrderIds: number[],
    newVisibleOrderIds: number[],
): ReorderEmployeesItem[] {
    // Сотрудник видимого подмножества, которого нет в `fullOrderIds` (справочник ещё не
    // догрузился/рассинхронизирован), отбрасывается ДО расстановки по слотам — иначе он занял бы
    // чужой слот и сдвинул бы нумерацию всех следующих за ним сотрудников. Тот же защитный приём
    // по смыслу, что и `-1`-guard в `useEditPlanForm.handleReorder`.
    const fullIdSet = new Set(fullOrderIds)
    const knownVisibleIds = newVisibleOrderIds.filter((id) => fullIdSet.has(id))

    const visibleSet = new Set(knownVisibleIds)
    const slotIndices: number[] = []
    fullOrderIds.forEach((id, index) => {
        if (visibleSet.has(id)) slotIndices.push(index)
    })

    // `knownVisibleIds[i]` берёт себе слот `slotIndices[i]` — тот индекс `fullOrderIds` и
    // становится его новым `order`. Оба массива всегда одной длины (оба получены фильтрацией по
    // одному и тому же множеству id), поэтому `slotIndices[i]` определён для каждого элемента.
    return knownVisibleIds.map((employeeId, i) => ({ employeeId, order: slotIndices[i] }))
}

import type { BalanceSummaryEmployee } from 'ireports-contracts'

export type SettlementsDepartmentGroup = {
    departmentId: number
    departmentName: string
    /** Подытог группы — сумма `employee.balance` по всем сотрудникам этого отдела в текущей
     * выборке (не отдельное поле с бэкенда, см. doc ниже). */
    balance: number
    employees: BalanceSummaryEmployee[]
}

/**
 * Группировка сотрудников по отделу для мобильной карточной раскладки (Pencil `wZnzC`, Фаза 4
 * docs/employee-settlements-page-redesign) — используется только при просмотре «Все отделы»
 * (`departmentId === null` в `useEmployeeSettlementsPage`); когда выбран конкретный отдел,
 * `employees` уже содержит сотрудников одного отдела и группировка не нужна — см.
 * `EmployeeSettlementsCardList`'s `groupByDepartment` prop.
 *
 * Порядок групп — по первому появлению сотрудника этого отдела в `employees` (порядок
 * приходит с бэкенда, `GetBalanceSummaryService`), НЕ по алфавиту и не по величине остатка —
 * так порядок групп на мобильной раскладке не расходится с порядком строк десктопной таблицы
 * (`EmployeeSettlementsTable`, у которой группировки нет вовсе, PRD: "для десктопной
 * раскладки — плоская таблица ... группировка не обязательна").
 *
 * Подытог (`balance`) вычисляется на фронте суммированием строк выборки, а не берётся
 * отдельным полем с бэкенда: в `BalanceSummaryResponse` подытогов по отделу нет (только KPI
 * по всей выборке в `totals`), и добавлять их не требуется — сумма по уже загруженным
 * `employee.balance` тривиальна и не нуждается в новом эндпоинте/поле контракта.
 */
export function groupEmployeesByDepartment(employees: BalanceSummaryEmployee[]): SettlementsDepartmentGroup[] {
    const order: number[] = []
    const groups = new Map<number, SettlementsDepartmentGroup>()

    for (const employee of employees) {
        let group = groups.get(employee.departmentId)
        if (!group) {
            group = {
                departmentId: employee.departmentId,
                departmentName: employee.departmentName,
                balance: 0,
                employees: [],
            }
            groups.set(employee.departmentId, group)
            order.push(employee.departmentId)
        }
        group.balance += employee.balance
        group.employees.push(employee)
    }

    return order.map((departmentId) => {
        const group = groups.get(departmentId)
        if (!group) throw new Error(`groupEmployeesByDepartment: missing group for departmentId=${departmentId}`)
        return group
    })
}

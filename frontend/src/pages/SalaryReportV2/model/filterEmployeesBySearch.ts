/**
 * Клиентский текстовый фильтр по имени сотрудника (Pencil-диф "Search Сотрудник", Filter Row
 * `AqQmX/Vbvkc`'s `lMQ4p`) — работает поверх уже загруженного `report.employees[]`, без нового
 * запроса к бэкенду (контракт отчёта отдела не предоставляет серверного поиска по имени). Регистро-
 * независимый поиск подстроки где угодно в имени; пустой запрос пропускает всех сотрудников.
 */
export function filterEmployeesBySearch<T extends { name: string }>(employees: T[], search: string): T[] {
    const query = search.trim().toLowerCase()
    if (!query) return employees
    return employees.filter((employee) => employee.name.toLowerCase().includes(query))
}

/** «Артём Мурыгин» -> «АМ» — инициалы аватара строки ростера (узел `A5SbT` -> `Section На смене`
 * -> `Roster Card` -> `Row *` -> `Avatar` -> `Initials`). Первые буквы первых двух слов ФИО; при
 * одном слове (сервисные/тестовые учётные записи без фамилии в Bitrix) — первые две буквы самого
 * слова, чтобы аватар не оставался пустым. */
export function getEmployeeInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return '?'
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
    return (words[0][0] + words[1][0]).toUpperCase()
}

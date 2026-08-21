/**
 * "N сотрудников" с русской плюрализацией (1 сотрудник / 2-4 сотрудника / 5+ и 11-14
 * сотрудников) — используется KPI-подписью (`DepartmentTotalsKpi`), заголовком секции
 * сотрудников и мобильной "Count Note" (`DepartmentReportBody`), поэтому вынесено сюда, а не
 * продублировано в каждом месте по отдельности (тот же приём, что и `kernel/pluralizeRules.ts`,
 * только для этой страницы — правило по числу сотрудников больше нигде в приложении не нужно).
 */
export function pluralizeEmployees(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'сотрудник'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'сотрудника'
    else word = 'сотрудников'
    return `${count} ${word}`
}

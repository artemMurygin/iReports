// "Вариант" услуги (тип используемой запчасти: OEM/AASP/HQ) для страницы
// аналитики услуг (Pencil: design/sallary-first-iteration.pen, узел `h7eHG`,
// "Variant Tabs"/"Variant Chip"). В ERP (RemOnline) под это нет отдельного
// поля — сигнал кодируется прямо в названии услуги суффиксом (реальные данные
// из RoApp: "Замена аккумулятора iPhone 13 | OEM", "... | AASP"), поэтому
// вариант определяется разбором `serviceName`, а не отдельным полем контракта.
//
// Матчинг — по полному токену суффикса ("OEM"/"AASP"/"HQ"), не по короткой
// 2-3-буквенной подстроке: изначально обсуждалось матчить "OM"/"ASP"/"HQ", но
// "OM" не является подстрокой "OEM" (между O и M стоит E) — с такой подстрокой
// вкладка/бейдж "OEM" не находили ни одной реальной строки (проверено на
// живых данных RoApp через Playwright). "ASP" для AASP было бы рабочим (AASP
// содержит ASP как подстроку), но для единообразия и на случай появления в
// названии как "AASP", так и отдельного "ASP" с другим смыслом — матчим тоже
// полным токеном.
export type ServiceVariant = 'OEM' | 'AASP' | 'HQ'

const VARIANT_MATCHERS: { variant: ServiceVariant; needle: string }[] = [
    { variant: 'AASP', needle: 'AASP' },
    { variant: 'OEM', needle: 'OEM' },
    { variant: 'HQ', needle: 'HQ' },
]

export function parseServiceVariant(serviceName: string): ServiceVariant | null {
    const upper = serviceName.toUpperCase()
    for (const { variant, needle } of VARIANT_MATCHERS) {
        if (upper.includes(needle)) return variant
    }
    return null
}

export const SERVICE_VARIANT_FILTER_OPTIONS = ['Все', 'OEM', 'AASP', 'HQ'] as const
export type ServiceVariantFilter = (typeof SERVICE_VARIANT_FILTER_OPTIONS)[number]

// "Все" не фильтрует вовсе — остальные вкладки матчат ту же подстроку, что и
// parseServiceVariant.
export function matchesServiceVariantFilter(serviceName: string, filter: ServiceVariantFilter): boolean {
    if (filter === 'Все') return true
    return parseServiceVariant(serviceName) === filter
}

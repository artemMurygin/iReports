/** Стили и подписи поповера выбора категории услуг — перенесены из понравившейся пользователю
 * реализации `features/SalaryRuleForm/ui/CategoryField/ui/categoryOverlay.ts` (поле «Категория
 * товара» зарплатного правила магазина): поиск + дерево + закреплённая строка «Все категории» +
 * футер со сбросом, вместо простого дерева без поиска. */

export const ALL_CATEGORIES_LABEL = 'Все категории'

export type CategorySearchClasses = { row: string; icon: string; input: string; clearIcon: string }

export const SEARCH_CLASSES: CategorySearchClasses = {
    row: 'flex items-center gap-2 border-b border-hairline p-2.5',
    icon: 'size-[14px] shrink-0 text-ink-faint',
    input: 'w-full bg-transparent font-ui text-[13px] text-ink outline-none placeholder:text-ink-faint',
    clearIcon: 'size-[13px]',
}

export type CategoryTreeClasses = {
    row: string
    toggle: string
    toggleIcon: string
    spacer: string
    folderIcon: string
    nodeLabel: string
    allRow: string
    allIcon: string
    allLabel: string
    matchRow: string
    matchName: string
}

export const TREE_CLASSES: CategoryTreeClasses = {
    row: 'flex w-full items-center gap-1.5 rounded-[8px] py-[7px] pr-2.5 text-left transition-colors',
    toggle: 'flex size-4 shrink-0 items-center justify-center text-ink-muted hover:text-ink',
    toggleIcon: 'size-3.5 transition-transform',
    spacer: 'size-4 shrink-0',
    folderIcon: 'size-[13px] shrink-0 text-ink-faint',
    nodeLabel: 'truncate font-ui text-[13px]',
    allRow: 'flex w-full items-center gap-1.5 rounded-[8px] py-[7px] pr-2.5 pl-2.5 text-left transition-colors',
    allIcon: 'size-[13px] shrink-0 text-ink-faint',
    allLabel: 'flex-1 truncate font-ui text-[13px]',
    matchRow: 'flex w-full flex-col items-start gap-0.5 rounded-[8px] px-2.5 py-[7px] text-left transition-colors',
    matchName: 'truncate font-ui text-[13px] font-medium text-ink',
}

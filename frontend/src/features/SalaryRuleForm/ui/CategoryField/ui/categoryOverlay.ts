/** Общие для обоих оверлеев поля «Категория товара» константы и типы: `CategoryCombobox.tsx`
 * (popover на `md:` и выше) и `CategoryBottomSheet.tsx` (bottom sheet ниже `md:`, Фаза 5) —
 * это две breakpoint-презентации одного выбора, а не форк логики. Разметку дерева и поиска они
 * делят через `CategorySearchInput.tsx`/`CategoryTreeBody.tsx`, различаясь только размерами строк классов ниже. */

export const ALL_CATEGORIES_LABEL = 'Все категории'

/** Shared with `CategoryBottomSheet.tsx`'s trigger (Фаза 5) so the closed-state button looks
 * identical regardless of which overlay the current breakpoint opens. */
export const CATEGORY_TRIGGER_CLASS =
    'flex h-9 w-full items-center justify-between gap-2 rounded-[8px] border border-hairline bg-surface px-3 font-ui text-[13px] font-medium text-ink outline-none transition-colors focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-faint'

export type CategorySearchClasses = { row: string; icon: string; input: string; clearIcon: string }

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

export const POPOVER_SEARCH_CLASSES: CategorySearchClasses = {
    row: 'flex items-center gap-2 border-b border-hairline p-2.5',
    icon: 'size-[14px] shrink-0 text-ink-faint',
    input: 'w-full bg-transparent font-ui text-[13px] text-ink outline-none placeholder:text-ink-faint',
    clearIcon: 'size-[13px]',
}

export const POPOVER_TREE_CLASSES: CategoryTreeClasses = {
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

export const SHEET_SEARCH_CLASSES: CategorySearchClasses = {
    row: 'flex items-center gap-2 border-b border-hairline p-3',
    icon: 'size-[15px] shrink-0 text-ink-faint',
    input: 'w-full bg-transparent font-ui text-[14px] text-ink outline-none placeholder:text-ink-faint',
    clearIcon: 'size-[14px]',
}

export const SHEET_TREE_CLASSES: CategoryTreeClasses = {
    row: 'flex w-full items-center gap-1.5 rounded-[8px] py-[9px] pr-2.5 text-left transition-colors',
    toggle: 'flex size-5 shrink-0 items-center justify-center text-ink-muted hover:text-ink',
    toggleIcon: 'size-4 transition-transform',
    spacer: 'size-5 shrink-0',
    folderIcon: 'size-[14px] shrink-0 text-ink-faint',
    nodeLabel: 'truncate font-ui text-[14px]',
    allRow: 'flex w-full items-center gap-1.5 rounded-[8px] py-[9px] pr-2.5 pl-2.5 text-left transition-colors',
    allIcon: 'size-[14px] shrink-0 text-ink-faint',
    allLabel: 'flex-1 truncate font-ui text-[14px]',
    matchRow: 'flex w-full flex-col items-start gap-0.5 rounded-[8px] px-2.5 py-[9px] text-left transition-colors',
    matchName: 'truncate font-ui text-[14px] font-medium text-ink',
}

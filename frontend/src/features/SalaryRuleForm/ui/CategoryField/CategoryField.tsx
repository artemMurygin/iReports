import type { CatalogCategoryResponse } from 'ireports-contracts'

import { CategoryBottomSheet } from './ui/CategoryBottomSheet.tsx'
import { CategoryCombobox } from './ui/CategoryCombobox.tsx'

export type CategoryFieldProps = {
    value: string | null
    onValueChange: (value: string | null) => void
    categories: CatalogCategoryResponse[]
    isLoading?: boolean
    error?: string | null
    className?: string
}

/**
 * Поле выбора категории товара (`ProductSold`/`UsedProductSold`) — одно поле для карточки правила,
 * скрывающее внутри breakpoint-развилку.
 *
 * Фаза 5 (mobile adaptive): смонтированы оба оверлея, каждый скрыт на «чужом» брейкпоинте —
 * `CategoryCombobox` (popover, Pencil node `vtDMA`) в `hidden md:block`, `CategoryBottomSheet`
 * (bottom sheet, node `xF4KU`) в `md:hidden`. Оба получают одни и те же `value`/`onValueChange`,
 * то есть это две презентации одного выбора, а не два независимых состояния — см. комментарии в
 * самих файлах оверлеев.
 */
export function CategoryField({ value, onValueChange, categories, isLoading, error, className }: CategoryFieldProps) {
    return (
        <>
            <div className="hidden md:block">
                <CategoryCombobox
                    value={value}
                    onValueChange={onValueChange}
                    categories={categories}
                    isLoading={isLoading}
                    error={error}
                    className={className}
                />
            </div>
            <div className="md:hidden">
                <CategoryBottomSheet
                    value={value}
                    onValueChange={onValueChange}
                    categories={categories}
                    isLoading={isLoading}
                    error={error}
                    className={className}
                />
            </div>
        </>
    )
}

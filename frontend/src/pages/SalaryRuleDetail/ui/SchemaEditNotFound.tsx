import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

export type SchemaEditNotFoundProps = {
    /** Читаемое сообщение об ошибке — `errorMessage` из `useQuery` (`ApiError`, см.
     * `shared/errors/apiError.ts`) при 404 GET-по-id (схема не найдена, либо у неё 0 правил этого
     * направления — см. apiDesign плана "Редактирование зарплатных схем"), либо `undefined`
     * при некорректном `:direction`/`:id` в самом URL (страница ещё не успела дойти до запроса). */
    message?: string
}

/**
 * Общий для обоих направлений (`service/ui/ServiceSchemaEdit.tsx`, `shop/ui/ShopSchemaEdit.tsx`)
 * экран "схема не найдена" — переиспользует то же визуальное решение, что и снятый placeholder
 * `SalaryRuleDetailPage` (иконка в круге + заголовок + текст + "К списку схем"), но с danger-цветом
 * вместо нейтрального "в разработке": это уже не заглушка недостроенной страницы, а реальный
 * пограничный случай (несуществующий/чужого направления id).
 */
export function SchemaEditNotFound({ message }: SchemaEditNotFoundProps) {
    return (
        <main className="flex flex-1 flex-col bg-canvas">
            <div className="flex flex-col gap-4 px-4 py-5 md:px-7 md:py-6">
                <PageHeader title="Схема начисления" />

                <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 rounded-xl border border-hairline bg-surface px-6 py-16 text-center">
                    <div className="flex size-16 items-center justify-center rounded-full bg-danger-soft">
                        <AlertTriangle className="size-7 text-danger" />
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <h2 className="font-display text-lg font-bold tracking-[-0.2px] text-ink">Схема не найдена</h2>
                        <p className="max-w-[420px] font-ui text-[13px] leading-[1.5] text-ink-muted">
                            {message ?? 'Возможно, схема была удалена, а ссылка на неё устарела.'}
                        </p>
                    </div>

                    <Button asChild variant="secondary">
                        <Link to="/salaries/rules">
                            <ArrowLeft />К списку схем
                        </Link>
                    </Button>
                </div>
            </div>
        </main>
    )
}

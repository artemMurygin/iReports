import { Check } from 'lucide-react'

export type SaveStatusBannerProps = {
    /** `id` сохранённой схемы активного направления (`DirectionAdapter.savedSchemaId` — строка, см.
     * `model/types.ts`), `null` пока схема не сохранена. */
    schemaId: string | null
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `tSYIw` → зелёная плашка под шапкой, которая
 * появляется после успешного `POST` схемы.
 *
 * Компонент сам решает, рендерить ли себя (возврат `null` при отсутствии `schemaId`), чтобы условие
 * не жило в медиаторе: `mediator/SalaryRulesCreate.tsx` и `ui/SalaryRulesPage.tsx` не содержат
 * условного рендера (frontend/CLAUDE.md, "Mediator-компонент для страниц с несколькими виджетами").
 */
export function SaveStatusBanner({ schemaId }: SaveStatusBannerProps) {
    if (!schemaId) return null

    return (
        <div className="flex items-center gap-2 rounded-[10px] border border-brand-border bg-brand-soft p-[11px] font-ui text-[13px] text-ok-ink">
            <Check className="size-[15px] shrink-0" />
            Схема сохранена, ID: {schemaId}
        </div>
    )
}

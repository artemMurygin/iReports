import { Plus } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'

import { pluralizeRules } from '../../../model/ruleSummary.ts'

export type RuleListHeaderProps = {
    count: number
    isAddDisabled: boolean
    onAdd: () => void
    /** Eyebrow-текст над заголовком — у мастера создания это «ШАГ 2 · ЗА ЧТО НАЧИСЛЯЕМ» (шаг
     * пошагового флоу), у страницы редактирования пошагового флоу нет (цель уже зафиксирована
     * маршрутом), поэтому она передаёт «ПРАВИЛА СХЕМЫ» (Pencil node `AJpBQ`/`nhqIA`). */
    eyebrow?: string
}

const DEFAULT_EYEBROW = 'ШАГ 2 · ЗА ЧТО НАЧИСЛЯЕМ'

/**
 * Шапка колонки правил (Pencil node `tSYIw` → `Колонка · Правила` для создания, `AJpBQ`/`nhqIA`
 * для редактирования): eyebrow (см. `eyebrow` prop), счётчик «N правил», заголовок с описанием и
 * кнопка «Добавить правило».
 */
export function RuleListHeader({ count, isAddDisabled, onAdd, eyebrow = DEFAULT_EYEBROW }: RuleListHeaderProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-ui text-[10px] font-semibold tracking-[0.8px] text-ink-muted">
                        {eyebrow}
                    </span>
                    {count > 0 && (
                        <span className="rounded-[6px] bg-brand-soft px-2 py-[3px] font-ui text-[11px] font-semibold text-ok-ink">
                            {pluralizeRules(count)}
                        </span>
                    )}
                </div>
                <h2 className="font-display text-[17px] font-bold text-ink">Правила расчета заработной платы</h2>
                <p className="font-ui text-xs text-ink-muted">
                    Отдельные начисления внутри схемы: за что и в какой момент платим. Правил может быть сколько угодно.
                </p>
            </div>
            <Button type="button" onClick={onAdd} disabled={isAddDisabled}>
                <Plus />
                Добавить правило
            </Button>
        </div>
    )
}

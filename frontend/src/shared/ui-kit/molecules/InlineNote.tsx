import * as React from 'react'
import { Info } from 'lucide-react'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `F7ai0` (`ERP/Molecule/Inline Note`) —
 * add-task-salary-rule-links-comments, tasks.md группы 25/26 (ui-design.md «Новые компоненты
 * UI Kit»). Нейтральная плашка пустого состояния/ограничения — используется на карточке задачи
 * (`r86qEK`: «Ссылок пока нет…», «Комментариев пока нет…»), поэтому живёт в `shared/ui-kit`, а не
 * внутри одной фичи — существовавшие «Note»-блоки были локальными копиями внутри экранов
 * (напр. зелёный `brand-soft` в `TaskStatusCard.tsx`), не переиспользуемым компонентом.
 *
 * `icon` по умолчанию — `info` (тот же, что в базовом определении `F7ai0`) — вызывающий код может
 * переопределить его через проп, как и остальные `ref`-инстансы в этом ките.
 */
export type InlineNoteProps = {
    icon?: React.ReactNode
    children: React.ReactNode
    className?: string
}

function InlineNote({ icon, children, className }: InlineNoteProps) {
    return (
        <div
            data-slot="inline-note"
            className={cn('flex w-full items-center gap-2 rounded-lg border border-hairline bg-canvas p-3', className)}
        >
            {icon ?? <Info className="size-[15px] shrink-0 text-ink-muted" />}
            <p className="font-ui text-xs leading-snug text-ink-muted">{children}</p>
        </div>
    )
}

export { InlineNote }

import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/tw'

export type DialogAlertTone = 'ok' | 'warn' | 'danger' | 'info'

const TONE_BOX: Record<DialogAlertTone, string> = {
    ok: 'bg-brand-soft',
    warn: 'bg-warn-soft',
    danger: 'bg-danger-soft',
    info: 'bg-info-soft',
}

const TONE_TEXT: Record<DialogAlertTone, string> = {
    ok: 'text-ok-ink',
    warn: 'text-warn-ink',
    danger: 'text-danger',
    info: 'text-info-ink',
}

export type DialogAlertProps = {
    tone: DialogAlertTone
    icon: ReactNode
    title: string
    description: string
    /** Кнопка справа («Повторить» у ошибки ERP, Pencil `hhWeF`) — на мобильном переносится вниз. */
    action?: ReactNode
    className?: string
}

/**
 * Inline-alert диалогов расчётного периода (Pencil `GUo20`/`KPPJ5`/`hhWeF`/`xL1JD`:
 * зелёный «проверки пройдены», жёлтый «закрытие недоступно», красный «ошибка ERP»
 * с кнопкой «Повторить», синий «синхронизируем…»). Токены `*-soft`/`*-ink` — те же
 * пары, что у бейджей статусов UI Kit.
 */
function DialogAlert({ tone, icon, title, description, action, className }: DialogAlertProps) {
    return (
        <div
            data-slot="dialog-alert"
            data-tone={tone}
            role="status"
            className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl px-4 py-3.5 sm:flex-nowrap',
                TONE_BOX[tone],
                className,
            )}
        >
            <span className={cn('shrink-0 self-start pt-0.5 [&_svg]:size-[18px]', TONE_TEXT[tone])}>{icon}</span>
            <div className={cn('min-w-0 flex-1 basis-52 font-ui text-[13px]', TONE_TEXT[tone])}>
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5">{description}</p>
            </div>
            {action && <div className="shrink-0 max-sm:w-full">{action}</div>}
        </div>
    )
}

export { DialogAlert }

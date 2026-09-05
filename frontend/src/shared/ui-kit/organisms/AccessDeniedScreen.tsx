import { ArrowLeft, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/shared/ui-kit/atoms/Button.tsx'

type Props = {
    title?: string
    description?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `WZqMK` (`AccessDeniedScreen — Роли и
 * права`) → sub-frame `x9hYK` (`AccessDeniedScreen`) — a centered column: a 68px `surface`-filled,
 * `hairline`-bordered icon circle with a `lock` glyph, a font-display 20/700 title, a 13px
 * `ink-muted` body (capped at the frame's 560px text-block width, centered), and a secondary
 * "На главную" button (`arrow-left` + label) back to `/`.
 *
 * The Topnav shown around the card in the frame belongs to whatever page composes this screen
 * (`pages/AccessDenied`) or, for `features/Auth/ui/RequirePermission`'s in-place usage, to the
 * already-open page around it — this component reproduces only the inner card, matching
 * architecture.md's `title?`/`description?` props (add-bitrix24-auth-and-rbac, раздел 17
 * tasks.md). Presentational only: no branching, no data fetching — reused as-is by both
 * `pages/AccessDenied` and `RequirePermission`.
 */
export function AccessDeniedScreen({
    title = 'Недостаточно прав для этого раздела',
    description = 'Управление ролями и правами доступно сотрудникам с правом «Управление ролями». Обратитесь к администратору портала, чтобы получить нужную роль.',
}: Props) {
    return (
        <div role="alert" className="flex min-h-[420px] flex-col items-center justify-center gap-[18px] px-7 py-6 text-center">
            <div className="flex size-[68px] shrink-0 items-center justify-center rounded-full border border-hairline bg-surface">
                <Lock className="size-[26px] text-ink-muted" />
            </div>

            <div className="flex w-full max-w-[560px] flex-col items-center gap-[9px]">
                <h1 className="font-display text-xl font-bold tracking-[-0.3px] text-ink">{title}</h1>
                <p className="font-ui text-[13px] leading-[1.55] text-ink-muted">{description}</p>
            </div>

            <Button asChild variant="secondary">
                <Link to="/">
                    <ArrowLeft />
                    На главную
                </Link>
            </Button>
        </div>
    )
}

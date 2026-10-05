import { Info, RefreshCw } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { IconButton } from '@/shared/ui/icon-button'
import { cn } from '@/shared/lib/tw'

const APP_TITLE = 'iRepair · Синхронизация'

// Q14: hardcoded app description shown by the Help popover.
const APP_DESCRIPTION =
    'Загружает прайсы в МойСклад и Ремонлайн, получает цены обратно в таблицу, обновляет начисления мастеров и записывает категорию услуги в выбранную ячейку.'

/**
 * Implements FR1, UX1, UX6 of sheets-app-redesign: Header with Mark, brand title and a Help icon button
 * (`aria-label="Справка"`) that opens a click popover with the app description (Q14).
 */
export function AppHeader({ className }: { className?: string }) {
    return (
        <header data-testid="app-header" className={cn('flex items-center gap-2.5 px-3.5 pt-3.5 pb-3', className)}>
            <span
                aria-hidden="true"
                className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-foreground text-brand"
            >
                <RefreshCw className="size-[18px]" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 truncate font-brand text-[13px] font-bold text-foreground">
                {APP_TITLE}
            </span>
            <Popover>
                <PopoverTrigger asChild>
                    <IconButton aria-label="Справка" className="text-muted-foreground">
                        <Info />
                    </IconButton>
                </PopoverTrigger>
                <PopoverContent data-testid="app-help">
                    <p className="font-semibold">{APP_TITLE}</p>
                    <p className="mt-1 text-tooltip-body">{APP_DESCRIPTION}</p>
                </PopoverContent>
            </Popover>
        </header>
    )
}

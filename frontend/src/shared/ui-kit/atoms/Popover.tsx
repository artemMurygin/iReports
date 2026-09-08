import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` (`График работы · Календарь`) →
 * `Day Editor` — карточка, «привязанная» к своей ячейке (не модальное окно по центру экрана, как
 * `Modal.tsx`), поэтому обёрнута вокруг `radix-ui`'s `Popover`, а не `Dialog`: клик по ячейке
 * открывает поповер рядом с ней, клик снаружи/`Escape` закрывают его сам собой (Radix), без
 * ручного управления фокус-трапом или оверлеем, которые нужны настоящей модалке.
 *
 * Первый анкоренный (не по центру) поповер нового UI Kit — `shared/ui/popover.tsx` уже существует,
 * но styled на старых токенах (`bg-popover`, `text-popover-foreground`); этот компонент — его
 * аналог на токенах `shared/ui-kit/tokens/theme.css` (`frontend/CLAUDE.md`: «все новые страницы и
 * компоненты — в `shared/ui-kit`»), а не расширение старого файла.
 *
 * Голый набор Root/Trigger/Content — состоянием (`open`) владеет сам Radix (не пробрасывается
 * `open`/`onOpenChange` пропом), тем же приёмом, что и родная кнопка `<details>`: у каждой ячейки
 * графика свой независимый поповер, координировать который вручную незачем — Radix уже закрывает
 * один поповер при открытии соседнего (клик по чужому триггеру — это «клик снаружи» для текущего
 * открытого содержимого).
 */
function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
    className,
    align = 'start',
    sideOffset = 8,
    ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot="popover-content"
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    'z-50 w-[296px] origin-(--radix-popover-content-transform-origin) rounded-xl border border-hairline bg-surface p-3.5 shadow-[0px_8px_24px_-4px_rgba(1,3,6,0.12)] outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
                    className,
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    )
}

export { Popover, PopoverTrigger, PopoverContent }

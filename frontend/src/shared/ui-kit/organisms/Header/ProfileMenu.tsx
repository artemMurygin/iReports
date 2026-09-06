import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui-kit/atoms/Avatar'

import type { HeaderDesktopUser } from './HeaderDesktop'

/**
 * Pencil: design/sallary-first-iteration.pen, reusable component `FjbRC`
 * (`ERP/Organism/Menu Профиль`, 268px, `surface` fill, rounded 12, hairline
 * border, outer shadow) for the desktop popover, and `X2GpSa`
 * (`ERP/Mobile/Sheet Профиль`, 390px bottom sheet with grabber + safe-area
 * padding) for the mobile variant. Both share the same content: a `Menu
 * User` row (avatar/name/role), a divider, the caller-supplied `items`
 * (built from `ERP/Molecule/Menu Item`, node `WoLDj`), a second divider, and
 * a `danger`-toned "Выйти" row — assembled once here as `ProfileMenuContent`
 * and reused by both shells below instead of duplicating the six rows twice.
 */
export type ProfileMenuAction = {
    label: string
    icon: React.ReactNode
    /** Renders the row as a `Link` when present, a `button` otherwise. */
    to?: string
    onClick?: () => void
}

export type ProfileMenuData = {
    /** Navigable items rendered above the "Выйти" row (e.g. «Баланс», «Зарплатные правила»). */
    items: ProfileMenuAction[]
    onLogout: () => void
}

function ProfileMenuItemRow({
    label,
    icon,
    to,
    onClick,
    tone = 'default',
    size,
}: ProfileMenuAction & { tone?: 'default' | 'danger'; size: 'sm' | 'lg' }) {
    const compact = size === 'sm'
    const className = cn(
        "flex w-full items-center gap-2.5 text-left transition-colors outline-none select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        compact ? 'rounded-lg px-2.5 py-[9px] text-sm' : 'px-4 py-[14px] text-[15px]',
        tone === 'danger' ? 'text-danger [&_svg]:text-danger' : 'text-ink [&_svg]:text-ink-muted',
        tone === 'default' && compact && 'hover:bg-canvas',
        tone === 'danger' && compact && 'hover:bg-danger/10',
    )

    return to ? (
        <Link to={to} onClick={onClick} className={className}>
            {icon}
            <span className="flex-1 truncate">{label}</span>
        </Link>
    ) : (
        <button type="button" onClick={onClick} className={className}>
            {icon}
            <span className="flex-1 truncate">{label}</span>
        </button>
    )
}

function ProfileMenuContent({
    user,
    items,
    onLogout,
    size,
}: ProfileMenuData & { user: HeaderDesktopUser; size: 'sm' | 'lg' }) {
    const compact = size === 'sm'

    return (
        <div className={cn('flex flex-col', compact && 'gap-0.5')}>
            <div
                className={cn(
                    'flex items-center',
                    compact ? 'gap-2.5 px-2.5 pt-2 pb-2.5' : 'gap-3 px-4 pt-2.5 pb-3.5',
                )}
            >
                <Avatar size={compact ? 'default' : 'lg'}>
                    {user.avatarSrc ? <AvatarImage src={user.avatarSrc} alt={user.name} /> : null}
                    <AvatarFallback>{user.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                    <span
                        className={cn(
                            'truncate font-medium text-ink',
                            compact ? 'text-[13px]' : 'text-[15px] font-semibold',
                        )}
                    >
                        {user.name}
                    </span>
                    {user.role ? (
                        <span className={cn('truncate text-ink-muted', compact ? 'text-[11px]' : 'text-xs')}>
                            {user.role}
                        </span>
                    ) : null}
                </div>
            </div>

            <div className={compact ? 'px-1' : ''}>
                <div className="h-px w-full bg-hairline" />
            </div>

            <div className={cn('flex flex-col', compact && 'gap-0.5 py-0.5')}>
                {items.map((item) => (
                    <ProfileMenuItemRow key={item.label} {...item} size={size} />
                ))}
            </div>

            <div className={compact ? 'px-1' : ''}>
                <div className="h-px w-full bg-hairline" />
            </div>

            <div className={compact ? 'pt-0.5' : ''}>
                <ProfileMenuItemRow
                    label="Выйти"
                    icon={<LogOut />}
                    onClick={onLogout}
                    tone="danger"
                    size={size}
                />
            </div>
        </div>
    )
}

export type ProfileMenuPopoverProps = ProfileMenuData & {
    open: boolean
    onOpenChange: (open: boolean) => void
    user: HeaderDesktopUser
    trigger: React.ReactNode
}

/** Desktop variant (Pencil node `FjbRC`) — anchored under the Nav Bar's user block. */
function ProfileMenuPopover({ open, onOpenChange, trigger, user, items, onLogout }: ProfileMenuPopoverProps) {
    return (
        <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    data-slot="profile-menu-popover"
                    align="end"
                    sideOffset={8}
                    className="z-50 w-[268px] rounded-xl border border-hairline bg-surface p-1.5 shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
                >
                    <ProfileMenuContent
                        user={user}
                        items={items.map((item) => ({
                            ...item,
                            onClick: () => {
                                item.onClick?.()
                                onOpenChange(false)
                            },
                        }))}
                        onLogout={() => {
                            onOpenChange(false)
                            onLogout()
                        }}
                        size="sm"
                    />
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    )
}

export type ProfileMenuSheetProps = ProfileMenuData & {
    open: boolean
    onClose: () => void
    user: HeaderDesktopUser
}

/** Mobile variant (Pencil node `X2GpSa`) — bottom sheet with its own scrim, opened by tapping the app-bar avatar. */
function ProfileMenuSheet({ open, onClose, user, items, onLogout }: ProfileMenuSheetProps) {
    const rootRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (open) return
        const active = document.activeElement
        if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
            active.blur()
        }
    }, [open])

    return (
        <>
            <div
                data-slot="profile-menu-scrim"
                aria-hidden={!open}
                onClick={onClose}
                className={cn(
                    'fixed inset-0 z-40 bg-scrim transition-opacity duration-200 ease-out',
                    open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
            />
            <div
                ref={rootRef}
                data-slot="profile-menu-sheet"
                aria-hidden={!open}
                className={cn(
                    'fixed inset-x-0 bottom-0 z-[55] flex flex-col rounded-t-[20px] bg-surface shadow-xl transition-transform duration-200 ease-out',
                    open ? 'translate-y-0' : 'translate-y-full',
                )}
            >
                <div className="flex w-full items-center justify-center pt-2 pb-1">
                    <div className="h-1 w-9 rounded-full bg-ink-faint" />
                </div>
                <ProfileMenuContent
                    user={user}
                    items={items.map((item) => ({
                        ...item,
                        onClick: () => {
                            item.onClick?.()
                            onClose()
                        },
                    }))}
                    onLogout={() => {
                        onClose()
                        onLogout()
                    }}
                    size="lg"
                />
                <div className="h-[22px] w-full shrink-0" />
            </div>
        </>
    )
}

export { ProfileMenuPopover, ProfileMenuSheet }

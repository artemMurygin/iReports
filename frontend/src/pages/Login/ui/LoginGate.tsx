import { LogIn, Wrench } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button.tsx'

type Props = {
    onLogin: () => void
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `cewQc` (`Login — Войти через Bitrix24`) — a
 * full-height `canvas` background centering a 440px `surface` "Auth Card" (1px `hairline`
 * border, `radius-md` (10px) corners, outer shadow): brand mark (44px `ink`-filled rounded
 * square with a `wrench` icon in `brand`) + "iRepair" wordmark, a font-display 20/700 title, a
 * 13px `ink-muted` body, a full-width primary CTA (`log-in` icon), and an 11px `ink-faint`
 * footnote. No Topnav — `app/route-guard/ui/RouteGuard.tsx` renders this in place of
 * `<Layout />` in standalone/iOS context without a valid session (раздел 15 tasks.md), i.e.
 * before any session/user chrome exists.
 *
 * Presentational only (add-bitrix24-auth-and-rbac, раздел 18 tasks.md) — the CTA's click
 * handler is supplied by the caller (`pages/Login/ui/LoginPage.tsx` wires it to `features/Auth`'s
 * `useBitrixLogin().login()`) rather than called from here, so this component stays a plain,
 * hook-agnostic UI piece.
 */
export function LoginGate({ onLogin }: Props) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
            <div className="flex w-full max-w-[440px] flex-col items-center gap-[22px] rounded-[10px] border border-hairline bg-surface p-10 shadow-[0px_18px_48px_rgba(1,3,6,0.12)]">
                <div className="flex flex-col items-center gap-[10px]">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-ink">
                        <Wrench className="size-6 text-brand" />
                    </div>
                    <span className="font-display text-[17px] font-bold tracking-[-0.2px] text-ink">iRepair</span>
                </div>

                <div className="flex w-full flex-col items-center gap-[9px]">
                    <h1 className="font-display text-xl font-bold tracking-[-0.3px] text-ink">Войдите через Bitrix24</h1>
                    <p className="text-center font-ui text-[13px] leading-[1.55] text-ink-muted">
                        iReports использует учётную запись Bitrix24 вашей компании. Из iframe портала вход выполняется
                        автоматически — эта страница нужна только при открытии iReports отдельным сайтом или из
                        приложения.
                    </p>
                </div>

                <Button type="button" className="w-full justify-center" onClick={onLogin}>
                    <LogIn />
                    Войти через Bitrix24
                </Button>

                <span className="font-ui text-[11px] text-ink-faint">Откроется окно авторизации Bitrix24</span>
            </div>
        </div>
    )
}

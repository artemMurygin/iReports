import { useBitrixLogin } from '@/features/Auth'

import { LoginGate } from './LoginGate.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 18 tasks.md; architecture.md `pages/Login`: "Экран-шлюз
 * "Войдите через Bitrix24" для standalone-сайта/iOS без валидной сессии — CTA запускает OAuth
 * authorization code flow по клику пользователя". Рендерится `app/route-guard/ui/RouteGuard.tsx`
 * вместо `<Layout />` (раздел 15 tasks.md), поэтому сам не оборачивается в `app/Header`. Тонкая
 * обёртка: подключает `features/Auth`'s `useBitrixLogin()` к презентационному `LoginGate`.
 */
export function LoginPage() {
    const { login } = useBitrixLogin()

    return <LoginGate onLogin={login} />
}

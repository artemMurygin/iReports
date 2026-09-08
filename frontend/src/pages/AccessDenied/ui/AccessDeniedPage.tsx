import { AccessDeniedScreen } from '@/shared/ui-kit/organisms/AccessDeniedScreen.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 17 tasks.md; architecture.md `pages/AccessDenied`: "Экран
 * "нет доступа" при прямом переходе без нужного permission", структура — только `ui` (нет
 * `model`). Рендерится `app/route-guard/ui/RouteGuard.tsx` вместо `<Layout />` (раздел 15
 * tasks.md), поэтому сам не оборачивается в `app/Header` — тонкая обёртка над `AccessDeniedScreen`
 * с дефолтными пропсами.
 */
export function AccessDeniedPage() {
    return <AccessDeniedScreen />
}

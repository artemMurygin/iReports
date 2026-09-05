// Заглушка `pages/AccessDenied` (add-bitrix24-auth-and-rbac, раздел 15
// tasks.md) — нужна route-guard'у (`app/route-guard`), чтобы было что
// рендерить на месте защищённого роута при отсутствии нужного permission;
// полноценный `AccessDeniedScreen` по фрейму `WZqMK` (`design/sallary-
// first-iteration.pen`) — раздел 17 tasks.md, которая заменит этот
// компонент.
export function AccessDeniedPage() {
    return (
        <div role="alert">
            <p>Нет доступа</p>
        </div>
    )
}

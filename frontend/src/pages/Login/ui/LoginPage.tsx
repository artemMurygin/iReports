// Заглушка `pages/Login` (add-bitrix24-auth-and-rbac, раздел 15 tasks.md) —
// нужна route-guard'у (`app/route-guard`), чтобы было что рендерить в
// standalone-контексте без валидной сессии; полноценная вёрстка-шлюз
// «Войдите через Bitrix24» по фрейму `cewQc` (`design/sallary-first-
// iteration.pen`) и подключение `useBitrixLogin()` — раздел 18 tasks.md
// (`pages/Login/ui/LoginGate`), которая заменит этот компонент.
export function LoginPage() {
    return (
        <div role="status">
            <p>Войдите через Bitrix24</p>
        </div>
    )
}

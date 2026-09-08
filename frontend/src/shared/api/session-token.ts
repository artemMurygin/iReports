// In-memory holder для `session_id` в iframe-контексте
// (add-bitrix24-auth-and-rbac, раздел 15 tasks.md; spec:
// session#header-delivery-for-iframe требует хранить session_id ТОЛЬКО в
// памяти, не в localStorage/sessionStorage — переживание перезагрузки
// вкладки не требуется для iframe: `app/` заново инициирует embedded-логин
// при каждом старте приложения внутри портала). Обычная модульная
// переменная, а не React-состояние — читается axios-интерцептором
// (`axios.instance.ts`) вне React-дерева.
let sessionToken: string | null = null

export function getSessionToken(): string | null {
    return sessionToken
}

export function setSessionToken(token: string | null): void {
    sessionToken = token
}

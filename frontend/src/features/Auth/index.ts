// Публичный API `features/Auth` (add-bitrix24-auth-and-rbac, раздел 16
// tasks.md; architecture.md: "useHasPermission, useCurrentUser, useLogout,
// useBitrixLogin, RequirePermission") — только корневые экспорты,
// импортировать фичу следует исключительно отсюда (frontend/CLAUDE.md).
export { useHasPermission } from './model/useHasPermission.ts'
export { useCurrentUser, type CurrentUserState } from './model/useCurrentUser.ts'
export { useLogout } from './model/useLogout.ts'
export { useBitrixLogin } from './model/useBitrixLogin.ts'
export { RequirePermission } from './ui/RequirePermission.tsx'

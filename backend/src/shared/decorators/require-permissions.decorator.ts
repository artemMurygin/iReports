import { SetMetadata } from '@nestjs/common';

// spec: roles#permission-check-on-route. Роут доступен только сотруднику,
// чьи permissions (из валидной сессии) включают ВСЕ перечисленные значения
// — сверяется PermissionsGuard через Reflector. Ссылается на PermissionCode
// .code константы из <module>.permissions.ts, не на голую строку (design.md,
// Decision 12) — опечатка ловится TypeScript'ом на этапе компиляции.
export const PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);

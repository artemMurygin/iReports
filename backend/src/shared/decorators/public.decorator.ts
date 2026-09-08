import { SetMetadata } from '@nestjs/common';

// Первый пример такого паттерна в проекте (design.md, Decision 5) — задаёт
// конвенцию для будущих guard'ов: SetMetadata + Reflector.getAllAndOverride
// в SessionAuthGuard/PermissionsGuard. Роут, помеченный @Public() (OAuth-
// callback, health-check и т.п.), не требует ни валидной сессии, ни каких-
// либо permissions (spec: roles#public-routes-no-authentication).
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// TTL sliding expiration (spec: session#sliding-expiration-ttl) —
// продлевается при каждой активности, значение конфигурируемо через
// переменную окружения. По умолчанию — 24 часа (рабочий день + запас).
export const SESSION_TTL_SECONDS = Number(
    process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24,
);

// Имя cookie с session_id для standalone-сайта/iOS (spec:
// session#cookie-delivery-for-standalone-and-ios) — тем же именем guard
// (session-request.util.ts) читает её обратно из req.cookies.
export const SESSION_COOKIE_NAME = 'session_id';

// Double-submit CSRF (design.md, Decision 7; spec:
// session#csrf-protection-for-cookie-session) — значение cookie НЕ HttpOnly
// (в отличие от session_id): фронтенд обязан прочитать его через
// document.cookie и вернуть тем же значением в заголовке ниже, чтобы
// CsrfGuard мог сравнить обе стороны double-submit.
export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

// Секрет HMAC для производного CSRF-токена (design.md, Decision 7 — значение
// CSRF-токена производное от session_id, отдельная запись в Redis не
// заводится). ДОЛЖЕН быть переопределён в проде через .env — тем же
// принципом, что и остальные секреты проекта (например
// BITRIX24_CLIENT_SECRET), запасное значение годится только для локальной
// разработки/тестов.
export const CSRF_SECRET =
    process.env.CSRF_SECRET ?? 'ireports-dev-insecure-csrf-secret';

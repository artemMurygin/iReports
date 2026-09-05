import { z } from 'zod';

// Контракты аутентификации Bitrix24 (add-bitrix24-auth-and-rbac,
// openspec/changes/add-bitrix24-auth-and-rbac/specs/auth/spec.md) — оба
// сценария входа (embedded/iframe и OAuth 2.0 authorization code flow)
// сходятся к единой внутренней модели (существующий BitrixEmployee, design.md
// Decision 2), поэтому у обоих сценариев единая форма ответа
// authenticatedSessionResponseSchema, отличается только набор полей запроса.

// ========================== Embedded/iframe-сценарий ========================== //

// AUTH_ID/member_id — переданные фронтендом после BX24.init() данные сессии
// BX24 (spec: auth#embedded-login-success); backend НЕ доверяет им напрямую —
// обязательная валидация реальным REST-запросом (spec:
// auth#embedded-token-must-be-verified-via-rest) происходит уже на backend,
// не на уровне контракта.
const bitrixEmbeddedLoginRequestSchema = z.object({
    authId: z.string().min(1),
    memberId: z.string().min(1),
});
export type BitrixEmbeddedLoginRequest = z.infer<
    typeof bitrixEmbeddedLoginRequestSchema
>;

// Доставка session_id для embedded-контекста — заголовок Authorization
// (spec: session#header-delivery-for-iframe), поэтому sessionId возвращается
// в теле ответа: frontend хранит его только в памяти (не
// localStorage/sessionStorage) и подставляет сам в каждый запрос.
const bitrixEmbeddedLoginResponseSchema = z.object({
    sessionId: z.string().min(1),
});
export type BitrixEmbeddedLoginResponse = z.infer<
    typeof bitrixEmbeddedLoginResponseSchema
>;

// ========================== OAuth 2.0 authorization code flow ========================== //

// `code`/`state` — параметры OAuth-редиректа (design.md, спек auth#oauth-
// authorization-code-flow); один и тот же контракт для standalone-сайта и
// iOS (spec: auth#ios-oauth — тот же backend-эндпоинт обмена кода на токены).
const bitrixOAuthCallbackRequestSchema = z.object({
    code: z.string().min(1),
    state: z.string().optional(),
});
export type BitrixOAuthCallbackRequest = z.infer<
    typeof bitrixOAuthCallbackRequestSchema
>;

// Доставка session_id для standalone-сайта/iOS — HttpOnly/Secure/
// SameSite=None cookie (spec: session#cookie-delivery-for-standalone-and-ios),
// устанавливаемая backend'ом через Set-Cookie — тело ответа НЕ содержит
// sessionId (иначе HttpOnly cookie теряла бы смысл: значение было бы всё
// равно доступно JS через тело ответа).
const bitrixOAuthCallbackResponseSchema = z.object({
    success: z.literal(true),
});
export type BitrixOAuthCallbackResponse = z.infer<
    typeof bitrixOAuthCallbackResponseSchema
>;

// ========================== Текущий пользователь ========================== //

// spec: roles#get-current-user — идентификатор пользователя и полный список
// его текущих permissions, для инициализации клиентского состояния после
// входа (useCurrentUser).
const authenticatedEmployeeSchema = z.object({
    id: z.number(),
    firstName: z.string(),
    lastName: z.string(),
});
export type AuthenticatedEmployee = z.infer<typeof authenticatedEmployeeSchema>;

const authMeResponseSchema = z.object({
    employee: authenticatedEmployeeSchema,
    permissions: z.array(z.string()),
});
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

// ========================== Logout ========================== //

// spec: session#logout-deletes-session-server-side — удаляет сессию из
// Redis, а не только cookie/состояние на клиенте.
const logoutResponseSchema = z.object({
    success: z.literal(true),
});
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

export {
    bitrixEmbeddedLoginRequestSchema,
    bitrixEmbeddedLoginResponseSchema,
    bitrixOAuthCallbackRequestSchema,
    bitrixOAuthCallbackResponseSchema,
    authenticatedEmployeeSchema,
    authMeResponseSchema,
    logoutResponseSchema,
};

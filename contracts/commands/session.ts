import { z } from 'zod';

// Сессионный слой (add-bitrix24-auth-and-rbac,
// openspec/changes/add-bitrix24-auth-and-rbac/specs/session/spec.md) не
// заводит собственных JSON-эндпоинтов в этом change — session_id доставляется
// исключительно через cookie (`Set-Cookie`, standalone/iOS) или заголовок
// `Authorization: Bearer <session_id>` (iframe), устанавливаемые/читаемые
// эндпоинтами `auth` (см. contracts/commands/auth.ts:
// bitrixEmbeddedLoginResponseSchema/bitrixOAuthCallbackResponseSchema), а
// CSRF double-submit (spec: session#csrf-protection-for-cookie-session) —
// через пару cookie/заголовок, тоже без JSON-тела. sessionDeliverySchema
// зафиксирован здесь как общий словарь значений (зеркалит backend
// `SessionDelivery` в session/application/ports/session.port.ts) — на случай
// будущего эндпоинта, которому потребуется явно назвать способ доставки в
// теле запроса/ответа.
const sessionDeliverySchema = z.enum(['cookie', 'header']);
export type SessionDelivery = z.infer<typeof sessionDeliverySchema>;

export { sessionDeliverySchema };

import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import {
    COOKIE_DOMAIN,
    CSRF_COOKIE_NAME,
    CSRF_SECRET,
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
} from '../session.config';

// Общая точка чтения session_id из запроса (Authorization: Bearer — iframe,
// spec: session#header-delivery-for-iframe; cookie — standalone/iOS, spec:
// session#cookie-delivery-for-standalone-and-ios). Вынесено из
// SessionAuthGuard (раздел 7 tasks.md) в отдельный модуль, чтобы разделом 12
// им же мог воспользоваться LogoutHttpController — тот же приём поиска
// session_id, не дублирующий код.
export function extractSessionId(request: Request): string | null {
    const authHeader = request.header('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }

    // Request.cookies типизирован @types/cookie-parser как Record<string,
    // any> (не optional), но на практике остаётся undefined, если
    // cookie-parser не подключён middleware'ом (например, в тестовом
    // окружении без него) — `?.` защищает от TypeError вместо честного 401
    // (fail-closed по сути того же принципа, что и Decision 10 design.md).
    const cookieSessionId = request.cookies?.[SESSION_COOKIE_NAME] as
        string | undefined;

    return cookieSessionId ?? null;
}

// Устанавливает session_id-cookie для cookie-варианта доставки (spec:
// session#cookie-delivery-for-standalone-and-ios) — HttpOnly (JS не может
// прочитать), Secure, SameSite=None (кросс-сайтовый iframe/редирект OAuth).
export function applySessionCookie(res: Response, sessionId: string): void {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: SESSION_TTL_SECONDS * 1000,
        path: '/',
        domain: COOKIE_DOMAIN,
    });
}

export function clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: COOKIE_DOMAIN,
    });
    res.clearCookie(CSRF_COOKIE_NAME, {
        secure: true,
        sameSite: 'none',
        path: '/',
        domain: COOKIE_DOMAIN,
    });
}

// Double-submit CSRF (design.md, Decision 7): значение — HMAC-SHA256(session_id)
// с серверным секретом, НЕ хранится отдельной записью в Redis. Cookie ниже
// умышленно НЕ HttpOnly — фронтенд обязан прочитать её и вернуть тем же
// значением в заголовке CSRF_HEADER_NAME при мутирующих запросах
// (CsrfGuard сверяет два независимых канала — cookie автоматически
// отправляется браузером кросс-сайтово, заголовок кросс-сайтовый скрипт
// проставить не может из-за CORS).
export function computeCsrfToken(sessionId: string): string {
    return createHmac('sha256', CSRF_SECRET).update(sessionId).digest('hex');
}

export function applyCsrfCookie(res: Response, sessionId: string): void {
    res.cookie(CSRF_COOKIE_NAME, computeCsrfToken(sessionId), {
        httpOnly: false,
        secure: true,
        sameSite: 'none',
        maxAge: SESSION_TTL_SECONDS * 1000,
        path: '/',
        domain: COOKIE_DOMAIN,
    });
}

// Сравнение постоянным временем — обычный `===` на секретных значениях
// теоретически уязвим к timing-атаке (пусть и малопрактичной для CSRF-токена
// такой длины); timingSafeEqual требует буферов равной длины, поэтому длины
// сверяются отдельно.
export function isValidCsrfToken(provided: string, sessionId: string): boolean {
    const expected = computeCsrfToken(sessionId);
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
}

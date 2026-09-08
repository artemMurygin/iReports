// Владелец — src/modules/session (design.md, Decision 1). Потребители —
// src/modules/auth (создание сессии при логине) и src/modules/roles
// (проталкивание новых permissions/принудительная инвалидация после смены
// прав роли). Токен + интерфейс объявлены здесь (владельцем), реализация
// (SessionService, раздел 7 tasks.md) регистрируется в SessionModule.
export type SessionDelivery = 'cookie' | 'header';

export interface CreateSessionResult {
    sessionId: string;
}

export interface SessionPort {
    // Генерирует новый session_id при КАЖДОМ вызове (защита от session
    // fixation, spec: session#session-id-entropy) — в т.ч. при повторном
    // логине уже вошедшего сотрудника.
    createSession(
        bitrixEmployeeId: number,
        permissions: string[],
        delivery: SessionDelivery,
    ): Promise<CreateSessionResult>;

    invalidateSession(sessionId: string): Promise<void>;

    invalidateAllSessionsForEmployee(bitrixEmployeeId: number): Promise<void>;

    // Push новых permissions во все активные сессии сотрудника — вызывается
    // `roles` сразу после изменения прав его роли (spec:
    // roles#immediate-permission-changes), без необходимости релогина.
    refreshPermissionsForEmployee(
        bitrixEmployeeId: number,
        permissions: string[],
    ): Promise<void>;
}

export const SESSION_PORT = Symbol('SESSION_PORT');

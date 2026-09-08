import { randomBytes } from 'crypto';
import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// >= 32 байта энтропии (session#session-id-entropy) — 32 случайных байта,
// закодированных base64url, дают строку из 43 символов без padding.
const ENTROPY_BYTES = 32;
const MIN_LENGTH = 43;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

// Самовалидирующийся формат/длина; сравнение по значению; генерируется
// заново на каждый логин (защита от session fixation, design.md/spec
// session#session-id-entropy) — см. SessionService.createSession
// (раздел 7 tasks.md).
export class SessionId extends ValueObject<string> {
    static generate(): SessionId {
        const value = randomBytes(ENTROPY_BYTES).toString('base64url');
        return new SessionId({ value });
    }

    static create(value: string): SessionId {
        if (
            !value ||
            value.length < MIN_LENGTH ||
            !BASE64URL_PATTERN.test(value)
        ) {
            throw new ArgumentInvalidException(
                'session_id должен быть base64url-строкой не менее 32 байт энтропии',
            );
        }

        return new SessionId({ value });
    }
}

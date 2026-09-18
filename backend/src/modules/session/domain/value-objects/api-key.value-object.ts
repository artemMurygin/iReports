import { createHash, randomBytes } from 'crypto';
import { ValueObject } from '@/shared/domain/value-object.base';

// add-employee-api-key-auth, design.md Decision 2: irk_<43 символа base64url>
// = randomBytes(32).toString('base64url') с префиксом `irk_` (iReports Key,
// для узнаваемости в логах/секрет-сканерах, по образцу ghp_/sk-), по образцу
// SessionId.generate() (session-id.value-object.ts), но без отдельной
// валидации формата: единственный способ получить экземпляр — generate(), то
// есть значение самовалидируется построением, а не проверкой на входе.
const ENTROPY_BYTES = 32;
const PREFIX = 'irk_';

export interface GeneratedApiKey {
    value: ApiKey;
    hash: string;
}

// add-employee-api-key-auth, design.md Decision 1: в базе хранится только
// SHA-256-хэш (hex) ключа, не сам ключ — сырое значение отдаётся вызывающему
// один раз, при generate()/регенерации, и не восстановимо из хэша.
export class ApiKey extends ValueObject<string> {
    private constructor(value: string) {
        super({ value });
    }

    static generate(): GeneratedApiKey {
        const raw = PREFIX + randomBytes(ENTROPY_BYTES).toString('base64url');
        return { value: new ApiKey(raw), hash: ApiKey.hash(raw) };
    }

    static hash(rawValue: string): string {
        return createHash('sha256').update(rawValue).digest('hex');
    }
}

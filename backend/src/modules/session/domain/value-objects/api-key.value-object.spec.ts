import { ApiKey } from './api-key.value-object';

// add-employee-api-key-auth, design.md Decision 1-2: формат ключа
// (irk_<43+ символа base64url>), детерминированность хэша для одного и того
// же входа, уникальность сгенерированных значений.
describe('ApiKey', () => {
    describe('generate', () => {
        it('генерирует значение в формате irk_<base64url, >= 32 байта энтропии>', () => {
            const { value } = ApiKey.generate();

            // base64url-строка кодирует 32 байта 43 символами без padding.
            expect(value.unpack()).toMatch(/^irk_[A-Za-z0-9_-]{43,}$/);
        });

        it('возвращает hash, совпадающий с ApiKey.hash(value)', () => {
            const { value, hash } = ApiKey.generate();

            expect(hash).toBe(ApiKey.hash(value.unpack()));
        });

        it('генерирует уникальное значение и хэш при каждом вызове', () => {
            const a = ApiKey.generate();
            const b = ApiKey.generate();

            expect(a.value.unpack()).not.toBe(b.value.unpack());
            expect(a.hash).not.toBe(b.hash);
        });
    });

    describe('hash', () => {
        it('детерминирована — один и тот же вход даёт один и тот же хэш', () => {
            const raw = ApiKey.generate().value.unpack();

            expect(ApiKey.hash(raw)).toBe(ApiKey.hash(raw));
        });

        it('стабильна для фиксированного входа между вызовами/процессами (SHA-256, hex)', () => {
            // design.md Decision 1: SHA-256 — фиксированный, воспроизводимый
            // алгоритм (в отличие от bcrypt/argon2 с солью), иначе поиск по
            // индексу `WHERE api_key_hash = ?` был бы невозможен.
            expect(ApiKey.hash('irk_fixed-test-value')).toBe(
                '9b2b4d15483a87517e303b6dade9d07caff23bfdcaf9cd3b8f32858cd5b15224',
            );
        });

        it('разные входы дают разные хэши', () => {
            expect(ApiKey.hash('irk_value-one')).not.toBe(
                ApiKey.hash('irk_value-two'),
            );
        });
    });
});

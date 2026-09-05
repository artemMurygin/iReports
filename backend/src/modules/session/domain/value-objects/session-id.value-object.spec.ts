import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SessionId } from './session-id.value-object';

// spec: session#session-id-entropy — session_id SHALL быть криптографически
// случайной строкой не менее 32 байт энтропии и SHALL генерироваться заново
// при каждом логине (защита от session fixation).
describe('SessionId', () => {
    describe('generate', () => {
        it('генерирует строку с достаточной энтропией (>= 32 байта)', () => {
            const sessionId = SessionId.generate();

            // base64url-строка кодирует 32 байта 43 символами без padding.
            expect(sessionId.unpack().length).toBeGreaterThanOrEqual(43);
        });

        it('генерирует уникальное значение при каждом вызове (защита от session fixation)', () => {
            const a = SessionId.generate();
            const b = SessionId.generate();

            expect(a.equals(b)).toBe(false);
        });
    });

    describe('create', () => {
        it('принимает валидное значение (например, из Redis/заголовка запроса)', () => {
            const raw = SessionId.generate().unpack();

            expect(SessionId.create(raw).unpack()).toBe(raw);
        });

        it.each(['', 'short', 'not base64url!!', 'a'.repeat(10)])(
            'отклоняет невалидное/слишком короткое значение "%s"',
            (value) => {
                withRequestContext(() => {
                    expect(() => SessionId.create(value)).toThrow(
                        ArgumentInvalidException,
                    );
                });
            },
        );
    });
});

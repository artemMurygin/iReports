import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { BitrixCredentials } from './bitrix-credentials.value-object';

// spec: auth#automatic-token-refresh — isExpired() лежит в основе решения
// BitrixTokenRefreshService.getValidAccessToken обновлять access_token до
// истечения срока его действия (раздел 6 tasks.md).
describe('BitrixCredentials', () => {
    describe('create', () => {
        it('создаёт VO из access/refresh токенов и даты истечения', () => {
            const credentials = BitrixCredentials.create({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date('2026-01-01T00:00:00Z'),
            });

            expect(credentials.accessToken).toBe('access-token');
            expect(credentials.refreshToken).toBe('refresh-token');
            expect(credentials.expiresAt).toEqual(
                new Date('2026-01-01T00:00:00Z'),
            );
        });

        it.each([
            ['', 'refresh-token'],
            ['access-token', ''],
        ])(
            'отклоняет пустой accessToken/refreshToken (%s, %s)',
            (accessToken, refreshToken) => {
                withRequestContext(() => {
                    expect(() =>
                        BitrixCredentials.create({
                            accessToken,
                            refreshToken,
                            expiresAt: new Date(),
                        }),
                    ).toThrow(ArgumentInvalidException);
                });
            },
        );
    });

    describe('isExpired', () => {
        it('возвращает true, если expiresAt в прошлом', () => {
            const credentials = BitrixCredentials.create({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() - 1000),
            });

            expect(credentials.isExpired()).toBe(true);
        });

        it('возвращает false, если expiresAt в будущем', () => {
            const credentials = BitrixCredentials.create({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date(Date.now() + 60_000),
            });

            expect(credentials.isExpired()).toBe(false);
        });

        it('принимает опциональный "текущий момент" для детерминированных тестов', () => {
            const credentials = BitrixCredentials.create({
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresAt: new Date('2026-01-01T00:00:00Z'),
            });

            expect(
                credentials.isExpired(new Date('2025-12-31T23:59:59Z')),
            ).toBe(false);
            expect(
                credentials.isExpired(new Date('2026-01-01T00:00:01Z')),
            ).toBe(true);
        });
    });
});

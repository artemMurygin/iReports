// Временный dev-only обход авторизации (тестирование функциональности без
// Bitrix24 OAuth/embedded-логина). AUTH_DISABLED=true само по себе
// недостаточно — NODE_ENV=production зашит в docker-compose.yml для обоих
// развёртываний (прод и dev-стенд), поэтому байпас технически не может
// сработать ни на одном из них, даже если AUTH_DISABLED случайно попадёт в
// серверный .env.
export function isDevAuthBypassEnabled(): boolean {
    return (
        process.env.AUTH_DISABLED === 'true' &&
        process.env.NODE_ENV !== 'production'
    );
}

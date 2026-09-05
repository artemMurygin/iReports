// TTL sliding expiration (spec: session#sliding-expiration-ttl) —
// продлевается при каждой активности, значение конфигурируемо через
// переменную окружения. По умолчанию — 24 часа (рабочий день + запас).
export const SESSION_TTL_SECONDS = Number(
    process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24,
);

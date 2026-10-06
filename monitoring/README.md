# Мониторинг iReports

Стек наблюдаемости backend: метрики (Prometheus), логи (Loki), дашборды (Grafana).
Всё описано в `docker-compose.yml`, конфиги лежат в этой папке.

## Состав стека и порты

| Сервис | Образ | Порт | Доступ |
|---|---|---|---|
| backend (`/metrics`, логи в Loki) | сборка из `backend/docker/Dockerfile` | `BACKEND_PORT` (по умолчанию 3000) | наружу |
| Loki | `grafana/loki:3.0.0` | 3100 | только внутренняя docker-сеть |
| Prometheus | `prom/prometheus:v2.53.0` | `127.0.0.1:${PROMETHEUS_PORT:-9090}` | только localhost |
| Grafana | `grafana/grafana:11.1.0` | `GRAFANA_PORT` (по умолчанию 3003) | наружу, логин `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` |

Backend пишет логи в Loki через pino-loki (`LOKI_HOST`), Prometheus скрейпит `backend:3000/metrics` каждые 15 с.

## Дашборды (папка «iReports»)

- **iReports · API** (`api-overview.json`) — метрики HTTP по маршрутам: нагрузка, ошибки, латентность, node-метрики процесса.
- **iReports · Ошибки** (`errors.json`) — ошибки по кодам `error_code`, маршрутам и контекстам, последние ошибки из логов.
- **iReports · Логи** (`logs.json`, uid `ireports-logs`) — поиск по логам: объём по уровням, топ контекстов, общий поток логов, отдельная панель HTTP-запросов, логи cron и синхронизаций. Фильтры сверху: уровень, контекст, текст, requestId, employeeId, маршрут, минимальный HTTP-статус (для панели «HTTP-запросы»).

## Лейблы Loki

| Лейбл | Значение |
|---|---|
| `app` | `ireports-backend` |
| `env` | окружение |
| `level` | `debug`, `info`, `warning`, `error`, `critical` (pino 40 превращается в `warning`) |
| `context` | имя класса из `new Logger(X.name)` или `HTTP` |

## Контракт полей строки лога (JSON)

HTTP-лог (одна строка на запрос, `context="HTTP"`), плоский JSON без вложенных req/res и заголовков:
`level`, `time`, `context`, `requestId`, `method`, `path` (без query), `route` (параметризованный или `unmatched`),
`status`, `durationMs`, `employeeId` (если есть), `auth` (`session` / `api-key` / `none`), `errorCode` (только при ошибке),
`err` (только при ошибке: `type`, `message`, `stack` только для 5xx, `code`, `status`, `config.{method,url}`, `response.{status,data}` до 1 КБ),
`msg` вида `GET /v1/... 200 12ms` или `GET /v1/... 500 — <message>`.

Уровни HTTP: 5xx — `error`, 4xx — `warn`, остальное — `info`. `/metrics` не логируется.
Сообщения Nest с контекстами `InstanceLoader`, `RoutesResolver`, `RouterExplorer` отбрасываются.

Лог приложения: `level`, `time`, `context`, `requestId` (если есть контекст запроса или cron), `msg`, `err` (тот же формат), произвольные поля.

Ошибки логируются так: `this.logger.error({ err: toError(e), ...поля }, 'Сообщение')`.
Формы `logger.error(msg, err.stack)` и `console.*` запрещены.

Тело ошибки API: `{ statusCode, message, error: <код>, correlationId, metadata?, subErrors? }`; `correlationId` равен `requestId` в логах.

## Метрики Prometheus (job `ireports-backend`)

- `http_requests_total{method,route,status_code}`
- `http_request_duration_seconds_{bucket,sum,count}{method,route,status_code}`
- `http_request_errors_total{method,route,status_code,error_code}`
- node-метрики prom-client: `nodejs_eventloop_lag_seconds` (и перцентили `nodejs_eventloop_lag_p99_seconds`), `nodejs_heap_size_used_bytes`, `process_resident_memory_bytes`, `process_cpu_seconds_total`, `process_start_time_seconds`

Коды `error_code`: доменные коды `ExceptionBase.code` как есть; `ZodValidationException` — `VALIDATION_FAILED`;
прочие `HttpException` — имя класса без `Exception` в UPPER_SNAKE (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_GATEWAY`, ...); неизвестные — `INTERNAL_ERROR`.

## Шпаргалка LogQL

Все логи одного запроса (HTTP-строка и бизнес-логика):

```logql
{app="ireports-backend"} | json | requestId="<id>"
```

Что делал сотрудник:

```logql
{app="ireports-backend", context="HTTP"} | json | employeeId="<id>"
```

Ошибки одного маршрута:

```logql
{app="ireports-backend", context="HTTP", level="error"} | json | route="/v1/some/:id"
```

Только 5xx:

```logql
{app="ireports-backend", context="HTTP"} | json | status >= 500
```

Ошибки cron и синхронизаций:

```logql
{app="ireports-backend", level=~"error|critical", context=~".*(Cron|Sync).*"}
```

## Как добавить панель

Дашборды провижинятся из `grafana/provisioning/dashboards/json/`. Отредактируй нужный JSON (или добавь новый файл) и закоммить:
Grafana перечитывает папку каждые 30 с (`updateIntervalSeconds`), перезапуск не нужен.
Удобный путь: собери панель в UI, выбери Share, Export, Export as JSON, и перенеси панель в файл. Датасурсы: Prometheus `uid: prometheus`, Loki `uid: loki`.
После правки проверяй JSON: `jq . файл.json`.

## Retention

Логи в Loki хранятся 30 дней (`limits_config.retention_period: 720h`, удаляет compactor), метрики в Prometheus — 30 дней (`--storage.tsdb.retention.time=30d`).

## Известные ограничения

`/metrics` публично доступен на `BACKEND_PORT`, поскольку backend опубликован наружу. Закрытие эндпоинта — отдельная задача.

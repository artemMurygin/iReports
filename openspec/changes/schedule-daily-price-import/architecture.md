# Architecture: schedule-daily-price-import

## Scope

Backend-only: новый планировщик в модуле `domains/shop/modules/marketing/pricing` (cron + оркестрация), две новые внешние интеграции (Google Drive — чтение файла, Telegram — уведомления) и хранение названия последнего выгруженного файла в Redis. Пайплайн импорта (`StartPriceImportHandler`), HTTP-эндпоинты, контракты и фронтенд не меняются.

---

## Backend — Domain Model

Новых доменных сущностей и агрегатов нет: состояние «последняя выгрузка» — один скаляр во внешнем key-value хранилище, а жизненный цикл самой выгрузки уже моделирует существующий агрегат `PriceImportJob`. Заводить для названия файла агрегат/репозиторий поверх Prisma избыточно (см. design.md, решение 4).

### Entities
| Name | Status | Aggregate root? | Ключевые поля | Назначение |
|---|---|---|---|---|
| `PriceImportJob` | existing | да | `id`, `status` (CREATED/RUNNING/COMPLETED/FAILED/CANCELLED), `errorMessage` | Источник итога выгрузки: планировщик читает его из `PRICE_IMPORT_JOB_STORE` по `command.id`; не меняется |

### Aggregates
| Aggregate | Root entity | Входит в состав | Инварианты |
|---|---|---|---|
| `PriceImportJob` | `PriceImportJob` | `JobProgress`, `PriceImportJobResult` | существующие, не меняются |

### Value Objects
| Name | Поля | Почему VO |
|---|---|---|
| `PriceListFile` (new, `domain/value-objects`) | `id: string`, `name: string`, `mimeType: string` | Описание найденного в папке файла: самовалидирующееся (непустые `id`/`name`), сравнение по значению; метод `isGoogleSpreadsheet()` — различает экспорт и прямое скачивание. Нужно и порту источника, и сервису оркестрации |
| `ScheduledImportOutcome` (new, `domain/value-objects`) | `kind: 'uploaded' \| 'unchanged' \| 'failed'`, `reason?: string` | Ограниченный набор исходов запуска; нотификатор выбирает текст по `kind`, `reason` — короткая причина для лога (не уходит в Telegram) |

### Domain exceptions (new, наследуют `src/shared/exceptions/exception.base.ts`)
| Exception | Когда |
|---|---|
| `PriceListFileNotFoundException` | в папке нет файлов |
| `PriceListFileAmbiguousException` | в папке больше одного файла |
| `PriceImportAlreadyRunningException` | при старте уже есть активная джоба |

### Ports
| Port (DI-токен) | Слой | Методы | Реализация |
|---|---|---|---|
| `PriceListSource` (`PRICE_LIST_SOURCE`) | application/ports | `findPriceListFile(): Promise<PriceListFile>`; `download(file: PriceListFile): Promise<Buffer>` | `GoogleDrivePriceListSource` |
| `PriceListVersionStore` (`PRICE_LIST_VERSION_STORE`) | application/ports | `getLastUploadedName(): Promise<string \| null>`; `saveUploadedName(name: string): Promise<void>` | `RedisPriceListVersionStore` |
| `PriceImportNotifier` (`PRICE_IMPORT_NOTIFIER`) | application/ports | `notifyUploaded()`, `notifyUnchanged()`, `notifyFailed()` — все `Promise<void>`, не бросают | `TelegramPriceImportNotifier` |
| `PriceImportJobStore` (`PRICE_IMPORT_JOB_STORE`) | application/ports | `findActive()`, `findById(id)` | существующий, переиспользуется |

### Services
| Service | Слой | Ответственность |
|---|---|---|
| `RunScheduledPriceImportService` (new) | application/services | Оркестрация одного запуска: найти файл → сравнить название → скачать → выполнить `StartPriceImportCommand` → прочитать итог джобы → уведомить → сохранить название при успехе. Перехватывает любое исключение и превращает его в `failed` |
| `ScheduledPriceImportCron` (new) | interface/cron | `@ProdCron('0 12 * * 1-5', { timeZone: 'Europe/Moscow' })`, только вызывает сервис |
| `GoogleDrivePriceListSource` (new) | infrastructure/drive | `files.list` по папке; скачивание: `files.export` (Google-таблица → XLSX) либо `files.get alt=media` (загруженный `.xlsx`) |
| `RedisPriceListVersionStore` (new) | infrastructure/redis | ключ `price-import:schedule:last-file-name` через `REDIS_CLIENT`, без TTL |
| `TelegramPriceImportNotifier` (new) | infrastructure/telegram | тексты сообщений (константы), `chatId` из `pricing.config.ts`; ошибки отправки логирует и глотает |
| `TelegramService` (new) | `src/integrations/telegram` | `sendMessage(chatId, text)` — `POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage` через `axios` |
| `ProdCron` (existing) | `src/shared/cron` | расширяется необязательным вторым аргументом `CronOptions` (для `timeZone`) без изменения текущих вызовов |

### Method Signatures
| Service.Method | Params | Returns | Описание |
|---|---|---|---|
| `RunScheduledPriceImportService.run` | — | `Promise<ScheduledImportOutcome>` | Один запуск; не бросает исключений |
| `PriceListSource.findPriceListFile` | — | `Promise<PriceListFile>` | Бросает `PriceListFileNotFoundException`/`PriceListFileAmbiguousException` |
| `PriceListSource.download` | `file: PriceListFile` | `Promise<Buffer>` | XLSX-содержимое независимо от типа файла |
| `PriceListVersionStore.getLastUploadedName` | — | `Promise<string \| null>` | `null`, если выгрузок ещё не было |
| `PriceListVersionStore.saveUploadedName` | `name: string` | `Promise<void>` | Вызывается только после успеха |
| `PriceImportNotifier.notifyUploaded/Unchanged/Failed` | — | `Promise<void>` | Не бросает |
| `TelegramService.sendMessage` | `chatId: string, text: string` | `Promise<void>` | Бросает при сетевой ошибке; ловит нотификатор |

---

## Frontend — UI Model

Не затрагивается: нет страниц, фич, компонентов и хуков. Ручная выгрузка через `sheets-app` остаётся прежней.

### Pages / Features / UI-компоненты / Hooks
Нет.

### Паттерны, которые нужно учесть
Не применимо (frontend не меняется).

---

## Diagrams

Доска: https://miro.com/app/board/uXjVEdlzLss=/ (три диаграммы расположены слева направо).

### 1. Domain Entity Interaction
Miro link: https://miro.com/app/board/uXjVEdlzLss=/?moveToWidget=3458764686184972427

### 2. External Modules Interaction
Miro link: https://miro.com/app/board/uXjVEdlzLss=/?moveToWidget=3458764686184972428

### 3. Layer Interaction — от Cron до уведомления
Miro link: https://miro.com/app/board/uXjVEdlzLss=/?moveToWidget=3458764686184972429

---

## Confirmation Checklist
- [ ] Названия value objects, портов и исключений согласованы
- [ ] Подтверждено, что новых сущностей/агрегатов и миграций БД нет (название файла — в Redis)
- [ ] Подтверждено, что frontend не затрагивается
- [x] Miro-доска и три диаграммы созданы

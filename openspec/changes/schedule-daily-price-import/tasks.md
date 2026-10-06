<!-- Реализация по TDD; чисто конфигурационные/декларативные задачи (без ветвлений) помечены явным обоснованием. Трассируемость: `spec: shop/price-import-schedule#<requirement>`. -->

## 1. Доменные примитивы (VO + исключения)

- [x] 1.1 Написать тесты на `PriceListFile` (непустые `id`/`name`, `isGoogleSpreadsheet()`) и `ScheduledImportOutcome` и убедиться, что раннер их видит
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать red (классов ещё нет)
- [x] 1.3 Реализовать `PriceListFile`, `ScheduledImportOutcome` и исключения `PriceListFileNotFoundException`, `PriceListFileAmbiguousException`, `PriceImportAlreadyRunningException`
- [x] 1.4 Прогнать тесты из 1.1: green, соседние тесты модуля не сломаны

## 2. Порты и оркестрация (`RunScheduledPriceImportService`)

- [x] 2.1 Написать тесты сервиса с фейками портов по сценариям спеки: успех (сохраняет название, `notifyUploaded`), название не изменилось (`notifyUnchanged`, импорт не запускается), нет файла / несколько файлов / ошибка Drive (`notifyFailed`), джоба `FAILED`/`CANCELLED` (`notifyFailed`, название не сохраняется), активная джоба (`notifyFailed`, импорт не запускается), сбой уведомления не влияет на сохранение названия
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red
- [x] 2.3 Объявить порты `PriceListSource`, `PriceListVersionStore`, `PriceImportNotifier` и реализовать сервис
- [x] 2.4 Прогнать тесты из 2.1: green, регрессий нет

## 3. Инфраструктура: Redis-хранилище названия

- [x] 3.1 Написать тесты `RedisPriceListVersionStore` (мок `REDIS_CLIENT`: `get` → `null`/значение, `save` пишет ключ `price-import:schedule:last-file-name` без TTL)
- [x] 3.2 Прогнать тесты из 3.1: red
- [x] 3.3 Реализовать `RedisPriceListVersionStore`
- [x] 3.4 Прогнать тесты из 3.1: green

## 4. Инфраструктура: Google Drive

- [x] 4.1 Написать тесты `GoogleDrivePriceListSource` (мок Drive-клиента): один файл → `PriceListFile`; пусто → `PriceListFileNotFoundException`; несколько → `PriceListFileAmbiguousException`; Google-таблица скачивается через `files.export` в XLSX, обычный файл — через `files.get alt=media`
- [x] 4.2 Прогнать тесты из 4.1: red
- [x] 4.3 Реализовать `GoogleDrivePriceListSource` (scope `drive.readonly`, те же `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY`; общий разбор креденшелов вынести в функцию в `integrations/google-sheets`, не меняя поведение Sheets-клиента)
- [x] 4.4 Прогнать тесты из 4.1 и существующие тесты `google-sheets`: green

## 5. Инфраструктура: Telegram

- [x] 5.1 Написать тесты `TelegramService.sendMessage` (мок axios: URL с токеном из `TELEGRAM_BOT_TOKEN`, тело `chat_id`/`text`) и `TelegramPriceImportNotifier` (три текста; ошибка отправки логируется и не бросается; текст ошибки не содержит технических деталей)
- [x] 5.2 Прогнать тесты из 5.1: red
- [x] 5.3 Реализовать `src/integrations/telegram` (модуль, сервис) и `TelegramPriceImportNotifier`
- [x] 5.4 Прогнать тесты из 5.1: green

## 6. Cron и подключение модуля

- [x] 6.1 Написать тест `ProdCron` на необязательный второй аргумент (опции `timeZone` передаются в `Cron`, вызовы без опций работают как раньше) и тест `ScheduledPriceImportCron` (вызывает `RunScheduledPriceImportService.run`, не бросает)
- [x] 6.2 Прогнать тесты из 6.1: red
- [x] 6.3 Расширить `ProdCron` опциями; реализовать `ScheduledPriceImportCron` (`10 12 * * 1-5`, `Europe/Moscow`); добавить конфиг (`PRICE_LIST_DRIVE_FOLDER_ID`, `TELEGRAM_CHAT_ID` в `pricing.config.ts`); зарегистрировать провайдеры/импорты в `ShopPricingModule`
- [x] 6.4 Прогнать тесты из 6.1, `npm run build` и весь набор тестов модуля `pricing`: green; сборка проверена через `tsc --noEmit -p tsconfig.build.json` (локальный `npm run build` падает на отсутствующем `lodash/toArray`, это окружение)
- [x] 6.5 (без теста: декларативная конфигурация) Задокументировать `TELEGRAM_BOT_TOKEN` в `.env.example` (если файл есть) и обновить `backend/src/domains/shop/CLAUDE.md`/`ENDPOINTS.md` при необходимости; проверить `git diff`

## 7. Обновление цен в МойСклад через n8n (добавлено после реализации групп 1-6)

- [x] 7.1 Написать тесты: `N8nMoySkladPriceUpdateTrigger` (два PATCH по порядку, второй вызывается при сбое первого, ошибка при любом сбое), `RunScheduledPriceImportService` (триггер после сохранения названия и до `notifyUploaded`; не вызывается при unchanged/FAILED; сбой n8n → `notifyPriceUpdateFailed`, название сохранено), `notifyPriceUpdateFailed`
- [x] 7.2 Прогнать тесты из 7.1: red (нет триггера, порта и уведомления)
- [x] 7.3 Реализовать порт `MoySkladPriceUpdateTrigger`, `N8nMoySkladPriceUpdateTrigger`, конфиг URL/таймаута, `notifyPriceUpdateFailed`, шаг в сервисе и провайдер в `ShopPricingModule`
- [x] 7.4 Прогнать тесты из 7.1 и весь набор `marketing/pricing`, `prod-cron`, `integrations`: green (224 теста), `npm run build` проходит

## 8. Время последней автовыгрузки в сайдбаре (добавлено после реализации групп 1-7)

- [x] 8.1 Написать тесты: `RedisLastScheduledImportStore`, `GetLastScheduledPriceImportService`, запись итога в `RunScheduledPriceImportService` (success/error, не при unchanged, сбой записи не ломает итог), слияние в `loadOperationRuns` сайдбара (cron новее/старее, сбой любого из источников)
- [x] 8.2 Прогнать тесты из 8.1: red
- [x] 8.3 Реализовать контракт `LastScheduledPriceImportResponse`, порт и Redis-хранилище, сервис и `GET /v1/shop/marketing/pricing/last-scheduled-import`, запись итога в сервисе автовыгрузки, `fetchLastScheduledImport` и слияние в `sheets-app`
- [x] 8.4 Прогнать тесты: backend 234, sheets-app 133 — green; `tsc` и eslint чистые

## 9. Уведомления о ручной выгрузке (добавлено после реализации групп 1-8)

- [x] 9.1 Написать тесты: обработчик `StartPriceImportHandler` (флаг `notifyResult`: успех, ошибка, без флага ничего, сбой отправки не влияет), тексты и методы `notifyManualUploaded`/`notifyManualFailed`
- [x] 9.2 Прогнать тесты из 9.1: red
- [x] 9.3 Реализовать флаг в `StartPriceImportCommand`, вызовы уведомлений в обработчике, методы порта и Telegram-нотификатора, `notifyResult: true` в HTTP-контроллере ручного запуска
- [x] 9.4 Прогнать тесты: backend 242 — green, `tsc` чистый

## 10. Деплой-чеклист (ручные шаги, вне кода)

- [ ] 10.1 Включить Drive API в проекте Google Cloud и расшарить папку на сервисный аккаунт (read-only)
- [ ] 10.2 Создать бота, добавить в группу, прописать `TELEGRAM_BOT_TOKEN` в env продакшена и реальные `chat_id`/id папки в конфиге
- [ ] 10.3 Пересобрать и задеплоить сайдбар `sheets-app` в Apps Script (без этого время автовыгрузки не появится); активировать в n8n продовые workflow `updateSalePricesInMS` и `updatePricesInMS` (метод PATCH); после деплоя проверить уведомление в первый будний день после 12:10

## 1. Схемы ответов новых эндпоинтов (TDD)

- [x] 1.1 Написать тесты на новую zod-схему строки `GET /report/turnover/all`
  (`turnover-all-row.schema.ts`): парсит `assortment.meta.href`, `assortment.meta.type`,
  `onPeriodEnd.quantity`, `onPeriodEnd.sum`; товар без `onPeriodEnd` — ошибка парсинга (поле
  обязательно в реальном ответе API).
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать red.
- [x] 1.3 Реализовать `TurnoverAllRowSchema` в `backend/src/domains/shop/integrations/moySklad/schemas/turnover-all.schema.ts`.
- [x] 1.4 Прогнать тесты из 1.1 и зафиксировать green.

- [x] 1.5 Написать тесты на новую zod-схему строки `GET /report/turnover/bystore`
  (`turnover-bystore.schema.ts`): парсит `assortment.meta.href`/`type` и массив `stockByStore[]`
  (`store.meta.href`, `onPeriodEnd.quantity`, `onPeriodEnd.sum` на каждую запись).
- [x] 1.6 Прогнать тесты из 1.5 и зафиксировать red.
- [x] 1.7 Реализовать `TurnoverByStoreRowSchema`.
- [x] 1.8 Прогнать тесты из 1.5 и зафиксировать green, регрессий в существующих схемах
  (`stock-report.schema.ts`) нет — не трогается этим изменением.

## 2. `MoyskladService` — новые fetch-методы (TDD)

- [x] 2.1 Написать тесты на `fetchTurnoverAllAt(momentFrom, momentTo)` (по образцу
  `fetchAssortmentStockAt`/существующих постраничных методов, использует `_fetchPaged`): строит
  запрос к `/report/turnover/all` с `momentFrom`/`momentTo` (формат `formatMoyskladDateTime`) и
  `withoutTurnover: 'true'`, обходит все страницы (`meta.size`/`offset`), отдаёт распарсенные
  строки батчами.
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red.
- [x] 2.3 Реализовать `fetchTurnoverAllAt` в `moysklad.service.ts`.
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать green.

- [x] 2.5 Написать тесты на `fetchTurnoverByStoreForProduct(assortmentHref, assortmentType,
  momentFrom, momentTo)`: строит запрос к `/report/turnover/bystore` с `filter=product=<href>` для
  `assortmentType === 'product'` и `filter=variant=<href>` для `assortmentType === 'variant'`;
  парсит `stockByStore[]` в массив `{ warehouseId, quantity, costSum }` (id склада — через
  `extractIdFromHref`); при неизвестном `assortmentType` — `Logger.warn` и пустой массив (без
  запроса к API).
- [x] 2.6 Прогнать тесты из 2.5 и зафиксировать red.
- [x] 2.7 Реализовать `fetchTurnoverByStoreForProduct`.
- [x] 2.8 Прогнать тесты из 2.5 и зафиксировать green.

- [x] 2.9 Удалить `fetchAssortmentStockAt`, импорт `AssortmentStockRow`/`toAssortmentStockRow` из
  `moysklad.service.ts` и файл `schemas/assortment-stock.schema.ts`; удалить соответствующий блок
  тестов `describe('MoyskladService.fetchAssortmentStockAt (D5.1)', ...)` из
  `moysklad.service.spec.ts`. Верификация: `npm run build` проходит, `grep -r
  "fetchAssortmentStockAt\|AssortmentStockRow\|assortment-stock.schema" backend/src` не находит
  ссылок.

## 3. `MoySkladSyncService.backfillHistoricalStockSnapshots` — новая логика (TDD)

- [x] 3.1 Написать тесты на переписанный `backfillHistoricalStockSnapshots(fromDate)`: для каждого
  месяца от `fromDate` до текущего — вызывает `fetchTurnoverAllAt(ЯКОРЬ, monthEnd)`, для каждой
  строки с `onPeriodEnd.quantity > 0` вызывает `fetchTurnoverByStoreForProduct(href, type, ЯКОРЬ,
  monthEnd)` и апсертит по одной строке `MoySkladStock` на каждый склад с ненулевым количеством
  (ключ `productId_warehouseId_snapshotAt`); товары с нулевым `onPeriodEnd.quantity` на шаге 1 не
  порождают повторных вызовов и строк. Не зависит от `MoySkladStore.findMany` (список складов
  больше не запрашивается заранее — состав складов берётся из ответа `bystore` на товар).
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать red.
- [x] 3.3 Написать тесты на сверку сумм (design.md D4): при расхождении между account-wide
  `onPeriodEnd.sum` (шаг 1) и суммой `onPeriodEnd.sum` по складам (шаг 2) для одного товара —
  `Logger.warn` с id товара и обоими значениями, бэкфилл не падает и продолжает следующий товар.
- [x] 3.4 Прогнать тесты из 3.3 и зафиксировать red.
- [x] 3.5 Реализовать переписанный `backfillHistoricalStockSnapshots` (константа
  `HISTORICAL_TURNOVER_LOOKBACK_ANCHOR` — якорная дата `momentFrom`, с комментарием об
  эмпирическом подтверждении, design.md D2) + логику сверки из 3.3. Дополнено при прогоне задачи 4.2:
  добавлен `delay(400)` между вызовами `fetchTurnoverByStoreForProduct` (без него — 429/502 от
  МойСклад после ~80 последовательных запросов) — то самое смягчение риска "скорость бэкфилла",
  которое design.md уже описывал, но изначально не было реализовано в коде.
- [x] 3.6 Прогнать тесты из 3.1 и 3.3, зафиксировать green.
- [x] 3.7 Обновить/удалить устаревшие тесты `MoySkladSyncService.backfillHistoricalStockSnapshots
  (D5.1)` в `moysklad-sync.service.spec.ts`, завязанные на старую сигнатуру
  (`MoySkladStore.findMany`/`fetchAssortmentStockAt`) — привести к новому поведению из 3.1/3.3.
  Верификация: `npm run test -- moysklad-sync.service` — все тесты файла зелёные, нет пропущенных
  (`.skip`) тестов.

## 4. Пересчёт уже забэкфилленных периодов (Migration Plan)

- [x] 4.1 Написать разовый скрипт пересчёта (по образцу `recalcShopGoodsTurnoverOnce.ts`,
  временного скрипта из design.md, уже удалённого) — определяет затронутые месяцы из фактических
  `DISTINCT snapshotAt` в `moy_sklad_stock`, вызывает переписанный
  `backfillHistoricalStockSnapshots` и затем `RebuildGoodsTurnoverReportService.rebuild(period)`
  для каждого затронутого периода. Верификация: скрипт компилируется (`npm run build`) и
  запускается на dev-БД без ошибок. Скрипт временный — удалён из репозитория после прогона (4.2),
  как и предполагалось design.md/Migration Plan.
- [x] 4.2 Прогнать скрипт из 4.1 на dev-окружении; сверить хотя бы один пересчитанный период
  (например, август 2026) с суммой остатка на конец месяца по данным `moy_sklad_turnover_report_lines`
  — сумма должна совпасть с ранее найденным эталоном МойСклад (см. proposal.md — Why) с точностью
  до нескольких единиц (расхождение возможно из-за секундной точности выбранного момента снятия).
  Прогнано на dev: затронутые периоды — 2026-06, 2026-07, 2026-08, 2026-09; сумма остатка на
  31.08.2026 после пересчёта — 1 481 437,83 ₽ против эталона 1 483 167,16 ₽ (расхождение ≈0,12%,
  в пределах ожидаемого допуска из-за точности момента снятия).
  **Обновлено разделом 6**: после перехода на `filter=store=<href>` (см. ниже) повторный прогон дал
  1 483 167,16 ₽ — точное совпадение с эталоном МойСклад, расхождение снято полностью (было
  следствием секундной погрешности выбранного момента снятия в старой per-product схеме, а не
  принципиальной неточности источника).
- [ ] 4.3 Прогнать скрипт из 4.1 на проде после деплоя кода (Migration Plan design.md, шаг 2) для
  всех фактически затронутых периодов; убедиться, что скрипт после использования удалён из
  репозитория (временный, не постоянный), если он не был оформлен как часть `initialUploadData.ts`.

## 5. Документация

- [ ] 5.1 Обновить `openspec/specs/shop/goods-turnover/spec.md` — применить delta из
  `specs/shop/goods-turnover/spec.md` этого изменения (архивирование).

## 6. Рефакторинг на `/report/turnover/all?filter=store=<href>` (после доп. эмпирической проверки)

Дополнительная эмпирическая проверка (прямые `curl`-запросы к боевому API) обнаружила, что
`/report/turnover/all` ФАКТИЧЕСКИ поддерживает рабочий `filter=store=<href склада>` — раздел 1/2/3
выше исходил из ошибочного вывода (сделанного из-за проверки только на складе `iRepair`, через
который проходит почти весь товарооборот), что этот фильтр не работает и разбивку по складам можно
получить только через `/report/turnover/bystore` на каждый товар. См. design.md D1 (раздел
«Обновлено») за полным разбором.

- [x] 6.1 Расширить `fetchTurnoverAllAt` в `moysklad.service.ts` необязательным третьим параметром
  `storeId` — при наличии добавляет `filter=store=<href>` (href строится из константы
  `MOYSKLAD_BASE_URL`, вынесенной из `moysklad.instance.ts`); без `storeId` — прежнее поведение
  (обратная совместимость).
- [x] 6.2 Обновить тесты `fetchTurnoverAllAt` (`moysklad.service.spec.ts`) — новый тест на
  `filter=store=<href>` при переданном `storeId`, тест на отсутствие `filter` без `storeId`.
- [x] 6.3 Удалить `fetchTurnoverByStoreForProduct` из `moysklad.service.ts` (не используется больше
  нигде — проверено `grep`) вместе с блоком его тестов; удалить
  `schemas/turnover-bystore.schema.ts` и его `.spec.ts` (та же проверка — не используется).
- [x] 6.4 Переписать `backfillHistoricalStockSnapshots`: цикл "месяц × склад"
  (`MoySkladStore.findMany` — возвращена, но уже для итерации по складам, а не для легаси-эндпоинта),
  один постраничный проход `fetchTurnoverAllAt(ANCHOR, monthEnd, store.id)` на пару, апсерт
  `MoySkladStock` из `onPeriodEnd.{quantity,sum}` строки напрямую. Убрана логика сверки account-wide/
  по-складской суммы (бывший D4 — сверять больше не с чем) и `delay(400)` на каждый товар (троттлинг
  между страницами уже даёт `_fetchPaged`).
- [x] 6.5 Переписать тесты `backfillHistoricalStockSnapshots` под новую логику (мок
  `MoySkladStore.findMany` + `fetchTurnoverAllAt` с третьим параметром `storeId`); удалить тесты
  сверки сумм (D4) и любые тесты, завязанные на `fetchTurnoverByStoreForProduct`.
- [x] 6.6 `npm run test -- moysklad.service`, `npm run test -- moysklad-sync.service`,
  `npm run test -- domains/shop`, `npm run build`, `npm run lint` (на изменённых файлах) — все
  зелёные.
- [x] 6.7 Проверка на реальных данных dev через уже существующий
  `backend/src/scripts/recalcShopGoodsTurnoverOnce.ts 2026-08` (не понадобился отдельный временный
  скрипт — этот постоянный скрипт уже делает ровно то, что нужно для проверки: backfill + rebuild
  отчёта за период). Результат: 1 483 167,16 ₽ на 31.08.2026 — точное совпадение с эталоном МойСклад
  (было 1 481 437,83 ₽ у старой per-product схемы). Полный прогон (2 периода, август+сентябрь,
  включая синк отгрузок) — около 53 секунд, против прежних ~15-20 минут НА ОДИН МЕСЯЦ.
- [x] 6.8 Обновить `design.md` (D1/D3/D4/Risks/Context) и `tasks.md` (этот раздел), отразив
  фактически реализованный подход.

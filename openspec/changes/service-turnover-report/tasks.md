## 1. Верификация допущений и рисков (до реализации)

- [x] 1.1 Проверить, что публичный REST API RemOnline действительно отдаёт список складов
  отдельным ресурсом (design.md D3, риск «допущение о наличии в публичном RoApp API...»).
  Верификация: свериться с документацией/тестовым вызовом RemOnline API; результат (найденный
  ресурс или его отсутствие — тогда нужен резервный источник, design.md «Риски») зафиксировать
  комментарием в реализации задачи 4.3.
  **Результат: ресурса нет** (проверено по официальному индексу документации RemOnline
  `roapp.readme.io` — прямой тестовый вызов живого API из этого окружения недоступен, см. 1.2).
  Допущение design.md D3 не подтвердилось — резервный источник для задачи 4.3 задокументирован в
  [`warehouse-api-finding.md`](./warehouse-api-finding.md).
- [x] 1.2 Замерить реальную задержку кастомного эндпоинта `POST /getGoodsFlowReport`
  (`rm.murygin.tech`) на серии последовательных запросов и оценить безопасный уровень
  параллелизма для будущего часового пересчёта (design.md, риск про комбинаторику
  категория×склад). Верификация: зафиксированные цифры задержки/лимита параллелизма,
  учтённые в реализации задачи 9.3, до включения крона (задача 11) в проде.
  **Результат: эндпоинт недоступен из этого окружения** (502 Bad Gateway, стабильно и на
  `getGoodsFlowReport`, и на уже рабочем в проде `/getServicesBonuses` — сетевой блокер
  окружения, не специфика метода). Замер задержки отложен до задачи 9.3/проверки со
  staging/прод-окружения; предложен безопасный дефолт параллелизма 3 — см.
  [`warehouse-api-finding.md`](./warehouse-api-finding.md).

## 2. Prisma-схема и миграция

- [x] 2.1 Добавить модель `RoappWarehouse` (`id`, `name`) в `prisma/schema/roapp.prisma`.
  Верификация: `npx prisma validate` проходит.
- [x] 2.2 Добавить модель `GoodsTurnoverReportLine` (`period`, `categoryId`, `warehouseId`,
  `outcomeQuantity`, `outcomeSum`, `stockQuantity`, `stockSum`, `turnoverRatio` nullable,
  уникальный индекс `(period, categoryId, warehouseId)`) в новый `prisma/schema/goods-turnover.prisma`.
  Верификация: `npx prisma validate` проходит.
- [x] 2.3 Прогнать `npx prisma generate --config prisma.config.ts` и
  `npx prisma migrate dev --config prisma.config.ts --name add-goods-turnover-report`.
  Верификация: миграция применяется без ошибок на чистой БД, клиент сгенерирован.
  **Отклонение от буквальной команды**: `prisma migrate dev` в этом окружении обнаружил drift
  общей dev-БД (`localhost:5432/iReports` шарится между git worktree разных веток — БД уже
  содержит миграцию `add_salary_task` другого, параллельного worktree, которой нет в истории этой
  ветки) и предлагал `prisma migrate reset` (полный дроп схемы, разрушительно для чужой
  параллельной работы). Вместо reset — сгенерирован изолированный diff только по двум новым
  моделям (`prisma migrate diff --from-schema/--to-schema` между схемой до и после правки, без
  подключения к живой БД), применён вручную (`psql -f migration.sql`) и зарегистрирован как
  применённый (`prisma migrate resolve --applied`) — итоговый файл миграции
  `prisma/migrations/20260908202323_add_goods_turnover_report/migration.sql` эквивalентен тому,
  что создал бы штатный `migrate dev --name add-goods-turnover-report`, но не тронул чужой drift.
  `prisma migrate status` после этого — "Database schema is up to date!", `npx prisma generate`
  сгенерировал `RoappWarehouse`/`GoodsTurnoverReportLine` в клиенте.

## 3. `modules/accounting`: экспорт `ACCOUNTING_PERIOD_REPOSITORY`

- [ ] 3.1 Добавить `ACCOUNTING_PERIOD_REPOSITORY` в `exports: [...]` `accounting.module.ts`
  (см. design.md D5 — сейчас модуль не экспортирует ничего; аддитивная правка без нового
  поведения, поэтому TDD-шаги пропущены — корректность проверяется косвенно, когда
  `WarehouseModule` (задача 13) успешно инжектит порт). Верификация: существующий тестовый
  набор `accounting` (`npm run test -- accounting`) по-прежнему проходит.

## 4. RoApp: справочник складов

- [ ] 4.1 Написать тест(ы) на метод получения списка складов из публичного API RemOnline
  (форма ответа — по итогам верификации 1.1) и на `RoappGatewayPort.fetchWarehouses`.
  Верификация: `npm run test -- roapp.service` видит новые тесты.
- [ ] 4.2 Прогнать тесты из 4.1, зафиксировать red (метода ещё нет).
- [ ] 4.3 Реализовать метод в `integrations/roapp/roapp.service.ts`
  (если API RemOnline не отдаёт складов отдельным ресурсом — реализовать резервный источник,
  см. design.md «Риски», и явно задокументировать это отклонение здесь), добавить
  `fetchWarehouses` в `RoappGatewayPort`/`RoappGatewayAdapter` (`integrations/roapp-gateway`).
- [ ] 4.4 Прогнать тесты из 4.1, зафиксировать green, без регрессий в `roapp.service.spec.ts`.
- [ ] 4.5 Написать тест(ы) на `RoappSyncService.uploadWarehouses()` (апсерт в `roappWarehouse`,
  по образцу `uploadProductCategories()`). Верификация: `npm run test -- roapp-sync` видит тест.
- [ ] 4.6 Прогнать тесты из 4.5, зафиксировать red.
- [ ] 4.7 Реализовать `uploadWarehouses()` в `roapp-sync.service.ts`, подключить в
  `application/command/upload-initial-roapp-data.handler.ts` (тот же разовый `npm run initial`,
  НЕ 5-минутный крон — design.md D3).
- [ ] 4.8 Прогнать тесты из 4.5, зафиксировать green, без регрессий в `roapp-sync.service.spec.ts`.

## 5. RoApp: клиент к `getGoodsFlowReport`

- [ ] 5.1 Написать тест(ы) на `CustomApiRoappService.getGoodsFlowReport` — payload
  `{startDate, endDate, category_id, warehouses}`, ответ `{outcome:{quantity,sum},
  stock:{quantity,sum}}`, Zod-валидация ответа, `BadGatewayException` при сбое (по образцу
  соседних методов `getServiceBonusById`/`createService`). Верификация:
  `npm run test -- custom-api-roapp` видит тест.
- [ ] 5.2 Прогнать тест из 5.1, зафиксировать red.
- [ ] 5.3 Реализовать `getGoodsFlowReport` в `custom-api-roapp.service.ts` +
  `schemas/goodsFlowReport.schema.ts`, добавить в `RoappGatewayPort`/`RoappGatewayAdapter`.
- [ ] 5.4 Прогнать тест из 5.1, зафиксировать green, без регрессий в
  `custom-api-roapp.service.spec.ts`.

## 6. Домен: `GoodsFlowMetric`, `GoodsTurnoverReportLine`, `GoodsTurnoverReport`

- [ ] 6.1 Написать тесты на `GoodsFlowMetric` VO (`quantity`/`sum` ≥ 0, сравнение по значению,
  immutable). Верификация: тест-раннер видит тесты.
- [ ] 6.2 Прогнать red.
- [ ] 6.3 Реализовать `GoodsFlowMetric` (`domain/value-objects/`, наследник
  `value-object.base.ts`).
- [ ] 6.4 Прогнать green.
- [ ] 6.5 Написать тесты на `GoodsTurnoverReportLine.calcRatio(stockPreviousSum)` — по сценариям
  `specs/service/goods-turnover/spec.md` («коэффициент считается по формуле среднего остатка в
  рублях», «нет сохранённых данных за прошлый месяц — коэффициент не рассчитывается», «средний
  остаток равен нулю — коэффициент не рассчитывается»).
- [ ] 6.6 Прогнать red.
- [ ] 6.7 Реализовать `GoodsTurnoverReportLine` (entity, метод `calcRatio`) и
  `GoodsTurnoverReport` (aggregate root, инвариант уникальности `(categoryId, warehouseId)` в
  пределах периода) — `domain/entities/`.
- [ ] 6.8 Прогнать green.

## 7. Application-порты

- [ ] 7.1 Определить `GOODS_TURNOVER_REPORT_LINE_REPOSITORY`/`GoodsTurnoverReportLineRepositoryPort`
  (`findByPeriod(period)`, `replaceAll(period, lines)`) в `application/ports/`.
  Верификация: `tsc --noEmit` проходит для нового файла.
- [ ] 7.2 Определить `PRODUCT_CATEGORY_REPOSITORY`/`ProductCategoryRepositoryPort`
  (`findAll()`, читает существующую `RoappProductCategory`) в `application/ports/`.
- [ ] 7.3 Определить `WAREHOUSE_REPOSITORY`/`WarehouseRepositoryPort` (`findAll()`, читает
  новую `RoappWarehouse`) в `application/ports/`.

## 8. Infrastructure: репозитории

- [ ] 8.1 Написать тест(ы) на `GoodsTurnoverReportLineRepository.replaceAll`/`findByPeriod`
  (Prisma, по образцу репозиториев `modules/accounting/infrastructure/repositories/`).
- [ ] 8.2 Прогнать red.
- [ ] 8.3 Реализовать `GoodsTurnoverReportLineRepository` (через `UNIT_OF_WORK` там, где нужна
  транзакционная согласованность — построение отчёта в событии закрытия, задача 12).
- [ ] 8.4 Прогнать green.
- [ ] 8.5 Реализовать `ProductCategoryRepository`/`WarehouseRepository` — простые read-репозитории
  без бизнес-инвариантов (по объёму тестов сравнимо со справочниками `modules/reports`, напр.
  `ListServiceCategoriesService`). Верификация: репозитории покрыты минимум одним тестом на
  корректный маппинг Prisma-модели в доменный тип.

## 9. Application: построение отчёта

- [ ] 9.1 Написать тесты на `BuildGoodsTurnoverReportService.build(period)` — обход дерева
  категорий (все категории и вложенные) × все склады, один вызов `getGoodsFlowReport` на пару
  (мок `ROAPP_GATEWAY`), довычисление `turnoverRatio` через `calcRatio` с чтением остатка
  прошлого периода из `GOODS_TURNOVER_REPORT_LINE_REPOSITORY` — по сценариям specs
  («покрывает все категории и вложенные», «категория без движения — нулевые показатели»,
  «отдельно по каждому складу», «позиция содержит все 4 показателя»).
- [ ] 9.2 Прогнать red.
- [ ] 9.3 Реализовать `BuildGoodsTurnoverReportService` (`application/services/`) — с учётом
  лимита параллелизма из задачи 1.2 и устойчивостью к сбою отдельной пары категория-склад (см.
  design.md D6 — частичный успех).
- [ ] 9.4 Прогнать green.

## 10. Application/Interface: чтение отчёта и справочников (GET)

- [ ] 10.1 Написать тесты на `GetGoodsTurnoverReportService.get(period)` (строки периода +
  справочники категорий/складов → форма ответа; период без сохранённых строк → пустой список,
  не ошибка — используется фронтендом для состояния «отчёт ещё не пересчитан»).
- [ ] 10.2 Прогнать red.
- [ ] 10.3 Реализовать `GetGoodsTurnoverReportService`.
- [ ] 10.4 Прогнать green.
- [ ] 10.5 Добавить Zod-схемы в `ireports-contracts` (ответ отчёта, справочники категорий и
  складов) — backend и frontend читают из одного места (`backend/CLAUDE.md`, Contracts).
  Верификация: пакет собирается, схемы экспортированы.
- [ ] 10.6 Реализовать HTTP-контроллеры: `GET /v1/service/warehouse/goods-turnover-report/:period`,
  `GET /v1/service/warehouse/product-categories`, `GET /v1/service/warehouse/warehouses` —
  каждый с `@ApiTags('Сервис: склад')` и `@ApiOperation({summary: '...'})` (обязательно —
  `backend/CLAUDE.md`, Swagger), DTO запроса через `nestjs-zod`.
- [ ] 10.7 Написать e2e-тест(ы) на контроллер отчёта (по образцу `*.e2e.spec.ts` в
  `modules/accounting/interface/http-controllers/`), прогнать и зафиксировать green.
- [ ] 10.8 Обновить `ENDPOINTS.md` тремя новыми маршрутами.

## 11. Крон: почасовой пересчёт открытого периода

- [ ] 11.1 Написать тесты на `RecalculateOpenGoodsTurnoverPeriodCron` — читает статус
  `AccountingPeriod('service', period)` через `ACCOUNTING_PERIOD_REPOSITORY` (нет записи или
  `isOpen()` → пересчитать; `isClosed()` → пропустить), продолжает при ошибке одной пары
  категория-склад (design.md D6).
- [ ] 11.2 Прогнать red.
- [ ] 11.3 Реализовать `RecalculateOpenGoodsTurnoverPeriodCron`
  (`@ProdCron(CronExpression.EVERY_HOUR)`, обёрнут в `runInSystemRequestContext` — по аналогии с
  `SalesPlanAutoCreationCron`) в `infrastructure/cron/`.
- [ ] 11.4 Прогнать green.

## 12. Событие: закрытие вместе с зарплатным периодом

- [ ] 12.1 Написать тесты на обработчик `CloseGoodsTurnoverPeriod` — подписка на
  `AccountingPeriodClosedDomainEvent`, реагирует только на `direction === 'service'` (событие с
  `direction: 'shop'` игнорируется), делает финальный пересчёт и сохраняет строки как снэпшот
  (design.md D7).
- [ ] 12.2 Прогнать red.
- [ ] 12.3 Реализовать `CloseGoodsTurnoverPeriod` (`@OnEvent('AccountingPeriodClosedDomainEvent')`,
  `application/events/`). Решение по design.md Open Questions: отдельного обработчика на
  переоткрытие `AccountingPeriod` не заводим — `ReopenAccountingPeriodHandler` не публикует
  событие, а часовой крон (задача 11) сам возобновит пересчёт открытого периода в течение часа.
- [ ] 12.4 Прогнать green.

## 13. Сборка модуля `warehouse`

- [ ] 13.1 Создать `domains/service/modules/warehouse/warehouse.module.ts`:
  `imports: [AccountingModule]` (для `ACCOUNTING_PERIOD_REPOSITORY`, задача 3), регистрация
  провайдеров/контроллеров/крона/обработчика события из задач 6–12. Файлы модуля — без слова
  `service` в имени (правило домена, `domains/service/CLAUDE.md`).
- [ ] 13.2 Подключить `WarehouseModule` в `app.module.ts`.
- [ ] 13.3 Добавить класс `WarehouseModule` в `include` документа `serviceDocument` в
  `src/config/swagger.config.ts` (обязательный шаг для нового DDD-модуля — `backend/CLAUDE.md`).
- [ ] 13.4 Прогнать `npm run build` и `npm run test` целиком. Верификация: оба проходят без
  ошибок и без регрессий в существующих наборах.

## 14. Разовая синхронизация справочника складов

- [ ] 14.1 Выполнить `npm run initial` (или отдельную ручную команду, если так решено в задаче
  4.7) на тестовом окружении. Верификация: таблица `roapp_warehouses` заполнена не пустым
  списком.

## 15. Frontend: страница `GoodsTurnoverReport` — каркас

- [ ] 15.1 Создать `pages/GoodsTurnoverReport/{index.ts, model/api.ts, ui/Layout.tsx}` — `api.ts`
  через `queryOptions` (`frontend/CLAUDE.md`, Query options factory), `Layout.tsx` с именованными
  слотами `header`/`body` (по образцу `pages/ServicesReport/ui/Layout.tsx`).
- [ ] 15.2 Зарегистрировать маршрут `goods-turnover-report` в `app/router.tsx`.
- [ ] 15.3 Написать тесты на `useGoodsTurnoverReportPage` (переключение периода/склада/категории
  инициирует нужные query; `isInitialLoad`/`isRefreshing` вычисляются поверх `useQuery` с
  `placeholderData: keepPreviousData`, как в `useServicesAnalytics`).
- [ ] 15.4 Прогнать red.
- [ ] 15.5 Реализовать `model/useGoodsTurnoverReportPage.ts` — плоский объект состояния/обработчиков.
- [ ] 15.6 Прогнать green.

## 16. Frontend: `WarehouseSelect` (ui-design.md, узел `M6ZfP` в `WvSO6`)

- [ ] 16.1 Прочитать структуру узла `M6ZfP` (и копий `dGAXG`/`yKcNQ`/`u6VEag`/`t2Qsc`; на мобайле
  склад показан `Chip`-триггером, узел `Yu5pP` в `yDBTb`) через `mcp__pencil__execute`/`Get` в
  `design/sallary-first-iteration.pen`.
- [ ] 16.2 Написать тесты на `WarehouseSelect` (выбор склада вызывает `onSelect`, отображает
  `selectedWarehouseId`, рендерит список из `warehouses` — произвольной длины, не ограничен 3).
- [ ] 16.3 Прогнать red.
- [ ] 16.4 Реализовать `WarehouseSelect` в `pages/GoodsTurnoverReport/ui/` (`shared/ui-kit/`) —
  select/combobox-компонент (не Tabs — по указанию пользователя при ревью макета, см.
  `architecture.md`), верстка по прочитанному в 16.1.
- [ ] 16.5 Прогнать green, сверить визуально со скриншотом узла `M6ZfP` (`TakeScreenshot`).

## 17. Frontend: `CategoryTreeSelect` (порт из `pages/ServicesReport`)

- [ ] 17.1 Портировать `pages/ServicesReport/ui/CategoryTreeSelect` в
  `pages/GoodsTurnoverReport/ui/CategoryTreeSelect` под справочник товарных категорий (не
  сервисных) — переиспользовать `shared/lib/tree.ts` (`getDirectChildren`, `getSubtreeIds`).
- [ ] 17.2 Написать тесты на адаптированный `model/categoryTree.ts` (аналог
  `resolveDescendantIds`/`searchCategories` под товарные категории).
- [ ] 17.3 Прогнать red.
- [ ] 17.4 Реализовать адаптацию.
- [ ] 17.5 Прогнать green.

## 18. Frontend: `GoodsTurnoverTable` — паттерн Ledger (ui-design.md, узел `D3Sf4` в `WvSO6`)

- [ ] 18.1 Прочитать структуру `Ledger Table` (`D3Sf4`) через `mcp__pencil__execute`/`Get`:
  строка «Итого» (`tcWPr`, 3 мини-метрики), `Header Row`, строки `R1`…`R4` с `Rail`/`Marker`/
  `Категория` (по одному `Rail` 16px на уровень предка, без капа глубины — подтверждено
  пользователем достаточным до 5 уровней), компактная высота строк 32px (верхний уровень/шапка)
  / 28px (вложенные) — см. ui-design.md, «Доработка таблицы».
- [ ] 18.2 Написать тесты на построение дерева строк таблицы из плоского `GoodsTurnoverRow[]` +
  `parentId` (вложенность произвольной глубины, число `Rail` равно глубине узла, нулевая
  категория остаётся обычной строкой с `—` в коэффициенте).
- [ ] 18.3 Прогнать red.
- [ ] 18.4 Реализовать `GoodsTurnoverTable` (`pages/GoodsTurnoverReport/ui/`) — рекурсивный рендер
  строк с `Rail`-отступами, колонки расход/остаток (шт/₽)/коэффициент (`—` при `null`), строка
  «Итого».
- [ ] 18.5 Прогнать green, сверить визуально со скриншотом узла `D3Sf4`.

## 19. Frontend: состояния экрана (ui-design.md, «Ключевые состояния»)

- [ ] 19.1 Реализовать состояние загрузки — `RefreshTransitionLayout`/`SpinnerPageLg` при
  `isInitialLoad` (узлы `jxljA` десктоп / `XJH3r` мобайл). Чисто визуальная задача без
  ветвлений — TDD-шаги не требуются, покрывается тестом 19.6 на переключение состояний.
- [ ] 19.2 Реализовать состояние ошибки — карточка с `ApiError.message` и кнопкой «Повторить»
  (узлы `t7VF4`/`akKcU`).
- [ ] 19.3 Реализовать состояние «отчёт ещё не пересчитан» — карточка без CTA (узлы
  `Q2EwKA`/`W9VKM`), показывается, когда бэкенд вернул пустой список строк для периода.
- [ ] 19.4 Реализовать бейдж закрытого периода в Filter Row (узлы `Sk1nF`/паттерн `VzQy1`/
  `RvLO7`) — без кнопки закрытия/пересчёта (design.md D7 — закрытие не действие пользователя).
- [ ] 19.5 Написать тесты на выбор состояния в `useGoodsTurnoverReportPage`/презентационном
  компоненте (какое состояние показывается при loading/error/пустых данных/`AccountingPeriod`
  закрыт — без условного рендера в самой странице, `frontend/CLAUDE.md`).
- [ ] 19.6 Прогнать red → реализовать логику выбора состояния → прогнать green.

## 20. Frontend: адаптивность 390 (ui-design.md, мобильные артборды)

- [ ] 20.1 Прочитать мобильные артборды (`yDBTb`/`RvLO7`/`XJH3r`/`akKcU`/`W9VKM`) через
  `mcp__pencil__execute`/`Get` — структура `App Bar` → `Body` (`Page Header` → `Filters` →
  контент) → `Bottom Nav`.
- [ ] 20.2 Реализовать адаптивные стили компонентов страницы под брейкпоинт 390 (Tailwind) —
  карточное представление строк, если так показано в мобильном макете (сверить по 20.1).
- [ ] 20.3 Проверить вручную в браузере на десктопной и мобильной ширине (навык `run`).
  Верификация: нет overflow/переполнения ни на одном брейкпоинте.

## 21. Интеграционная проверка «золотого пути»

- [ ] 21.1 Запустить бэкенд и фронтенд локально (`npm run start:dev` / `npm run start`),
  открыть `/goods-turnover-report`: отчёт строится по реальным/сид-данным, коэффициент
  отображается корректно (или `—` по правилам), переключение склада/категории/периода работает,
  закрытый период показывает бейдж без кнопки закрытия. Верификация: зафиксировать результат
  (скриншот/короткое описание) как подтверждение golden path перед архивацией change.

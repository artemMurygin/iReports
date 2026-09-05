## 1. Проверка готовности спеков

- [x] 1.1 Убедиться, что `specs/shop/{warehouse,marketing,moysklad-sync,sales,accounting}/spec.md`
      присутствуют в дереве специй этого change и проходят
      `openspec validate shop-domain-docs-migration-to-openspec --strict` без ошибок формата.
      Результат: `is valid`.
- [x] 1.2 Сверить каждое требование всех пяти спеков с существующими unit/e2e-тестами модулей —
      выполнено до и после зачистки комментариев (см. разделы 2–6). При этом обнаружен красный,
      предсуществующий этому change тест `start-price-import.handler.spec.ts` (не из-за пробела спека
      — из-за расхождения кода и его же теста, см. задачу 3.0); остальные ссылки на тесты подтверждены
      актуальными, зелёными.

## 2. `shop/warehouse` — CLAUDE.md, зачистка комментариев, проверка

- [x] 2.1 Заменить пункт «`warehouse` — склад/остатки товаров. Не существует.» в разделе «Целевой
      набор модулей домена» `backend/src/domains/shop/CLAUDE.md` на краткое описание уже реализованной
      части (дерево категорий каталога) и указатель на `openspec/specs/shop/warehouse/spec.md` —
      исправление фактической неточности, зафиксированной в proposal.md/design.md.
- [x] 2.2 Пройти комментарии `modules/warehouse/**` (`get-catalog.service.ts`,
      `category-node.value-object.ts`), объясняющие бизнес-правила (построение дерева одним запросом,
      неисключение архивных категорий) — заменить на `spec: shop/warehouse#<anchor>` там, где
      комментарий объясняет бизнес-правило, а не архитектурное решение (выбор value object вместо
      aggregate root — остаётся как есть; в `category-node.value-object.ts` архитектурных пояснений
      без бизнес-правила рядом не нашлось, комментарий не тронут).
- [x] 2.3 Прогнать `npm run test -- --testPathPatterns=domains/shop/modules/warehouse` — тесты
      остаются зелёными после зачистки комментариев. Результат: 3/3 suites, 7/7 tests.
- [x] 2.4 Прогнать `npm run validate:specs` на `backend/src/domains/shop/modules/warehouse` — все
      добавленные ссылки резолвятся без ошибок. Результат: `OK: проверено 3 spec-ссылок`.

## 3. `shop/marketing` — CLAUDE.md, зачистка комментариев, проверка

- [x] 3.0 (обнаружено при apply, вне исходного плана) Прогон тестов модуля до правок показал красный
      `start-price-import.handler.spec.ts` ("happy path"): тест ожидает вызов `batchUpdateProducts`,
      которого в коде не было (закомментирован в `start-price-import.handler.ts:91`) — тест
      предсуществовал этому change. По решению пользователя вызов `updateMoySklad()`
      раскомментирован; `specs/shop/marketing/spec.md` и proposal.md/design.md обновлены под уже
      актуальное поведение (обновление и МойСклад, и Google Sheets). Прогон
      `npm run test -- --testPathPatterns=domains/shop/modules/marketing` — 13/13 suites зелёные.
- [x] 3.1 Дополнить раздел `modules/marketing/pricing` `backend/src/domains/shop/CLAUDE.md` указателем
      на `openspec/specs/shop/marketing/spec.md` для бизнес-правил (архитектурные детали — структура
      портов, DI, выбор AI-адаптера — остаются в CLAUDE.md).
- [x] 3.2 Пройти объяснительные комментарии, объясняющие бизнес-правила, покрытые спеком
      `shop/marketing`, в `domain/entities/price-import-job.entity.ts` (`start()`/`updateProgress()`),
      `domain/services/row-categorization.service.ts` (порядок правил категоризации),
      `application/command/start-price-import.handler.ts` (`buildCostChanges()`) — заменены на
      `spec: shop/marketing#<anchor>`. Комментарии `complete()`/`fail()` в `price-import-job.entity.ts`
      и историко-архитектурный заголовок `start-price-import.handler.ts` не тронуты — не покрыты
      явно сформулированным Requirement (см. design.md — селективный критерий пилота).
- [x] 3.3 Прогнать `npm run test -- --testPathPatterns=domains/shop/modules/marketing` — тесты
      остаются зелёными. Результат: 13/13 suites, 81/81 tests.
- [x] 3.4 Прогнать `npm run validate:specs` на `backend/src/domains/shop/modules/marketing` — все
      добавленные ссылки резолвятся без ошибок. Результат: `OK: проверено 4 spec-ссылок`.

## 4. `shop/moysklad-sync` — CLAUDE.md, зачистка комментариев, проверка

- [x] 4.1 Заменить раздел `sync/moySklad` в `backend/src/domains/shop/CLAUDE.md` на краткое описание и
      указатель на `openspec/specs/shop/moysklad-sync/spec.md` для бизнес-правил (порядок upsert,
      полная замена позиций, докатка placeholder-товаров, резолв закупщиков, курсор докатки);
      архитектурные детали (класс-обёртка `MoyskladService`, `AsyncGenerator`-пагинация, отсутствие
      порта-гейтвея) остаются в CLAUDE.md.
- [x] 4.2 Пройти объяснительные комментарии в `moysklad-sync.service.ts` (докатка placeholder-товара с
      наследованием категории, полная замена позиций, дозагрузка неизвестной услуги, резолв
      закупщика), `moysklad-sync.mappers.ts` (`topoSortFolders`), `moysklad-sync.cron.ts` (блокировка
      направления, курсор `failedSince`) — заменены на `spec: shop/moysklad-sync#<anchor>`.
      Комментарии, объясняющие резолв закупщика "по имени, а не по id" и разбор типа значения
      кастомного атрибута (`moysklad-sync.mappers.ts`) не тронуты — это объяснение реализационного
      решения под неопределённость (UUID атрибута неизвестен в проде), а не бизнес-правило.
- [x] 4.3 Прогнать `npm run test -- --testPathPatterns=domains/shop/sync/moySklad` — тесты остаются
      зелёными после зачистки комментариев. Результат: 4/4 suites, 16/16 tests.
- [x] 4.4 Прогнать `npm run validate:specs` на `backend/src/domains/shop/sync/moySklad` — все
      добавленные ссылки резолвятся без ошибок. Результат: `OK: проверено 7 spec-ссылок`.

## 5. `shop/sales` — CLAUDE.md (включая исправление неточности), зачистка комментариев, проверка

- [x] 5.1 Заменить раздел `modules/sales` в `backend/src/domains/shop/CLAUDE.md` на краткое описание
      и указатель на `openspec/specs/shop/sales/spec.md` для бизнес-правил — **включая исправление
      обнаруженной неточности**: текущий текст описывает CRUD плана/шаблона как диспатч общих команд
      `domains/service/modules/sales` через `CommandBus`; заменено на описание полностью независимой
      реализации (собственные сущности/репозитории/хендлеры, см. design.md → Decision). Заодно
      исправлена внутренне противоречивая формулировка про `SHOP_SALES_PERFORMANCE_READER` ("для
      будущего `modules/accounting`", хотя тут же сказано, что он уже используется).
- [x] 5.2 Пройти объяснительные комментарии, объясняющие бизнес-правила, покрытые спеком `shop/sales`,
      в `domain/entities/sales-plan.entity.ts`, `domain/entities/sales-plan-template.entity.ts`,
      `domain/services/order-sales-plans.ts`, `domain/value-objects/sales-fact.value-object.ts`,
      `application/services/ensure-sales-plans-for-period.service.ts`,
      `infrastructure/repositories/moysklad-sales-fact-source.repository.ts`,
      `application/command/create-sales-plan.handler.ts` — заменены на `spec: shop/sales#<anchor>`.
      Архитектурные пояснения ("зеркало сервисного класса", DI-нюансы) не тронуты. Правило
      "типы заказов не ограничивают агрегацию факта МойСклад" — подтверждено отсутствием фильтрации
      по `orderTypeIds` в коде, а не заменой существующего комментария (такого комментария не было).
- [x] 5.3 Прогнать `npm run test -- --testPathPatterns=domains/shop/modules/sales` — тесты остаются
      зелёными после зачистки комментариев. Результат: 9/9 suites, 52/52 tests.
- [x] 5.4 Прогнать `npm run validate:specs` на `backend/src/domains/shop/modules/sales` — все
      добавленные ссылки резолвятся без ошибок. Результат: `OK: проверено 12 spec-ссылок`.

## 6. `shop/accounting` — CLAUDE.md, зачистка комментариев, проверка

- [x] 6.1 Заменить раздел `modules/accounting` в `backend/src/domains/shop/CLAUDE.md` (включая
      подраздел "Персистентность и оркестратор") на краткое описание и указатель на
      `openspec/specs/shop/accounting/spec.md` для бизнес-правил; явно зафиксировано в CLAUDE.md, что
      `cashbox-payout` в спек не входит (см. design.md → Decision) и остаётся описанным только здесь.
      Заодно исправлена обнаруженная неточность: `get`/`reopen`/`recalculate` расчётного периода
      описывались как переиспользующие generic-по-`direction` классы `service` "без своих классов" —
      по факту чтения кода (`Фаза 5–6 docs/service-shop-boundary-violations-fix`) все они уже
      независимые классы, как и `close`; также исправлено устаревшее "под теми же именами" про
      DI-токены — токены `shop` отдельно именованы (`SHOP_`-префикс), а не переиспользуют имена
      токенов `service`.
- [x] 6.2 Пройти объяснительные комментарии, объясняющие бизнес-правила, покрытые спеком
      `shop/accounting`, в `domain/entities/salary-rules/{pay-per-hour,product-sold,
      used-product-sold}.entity.ts`, `domain/services/role-source.ts`,
      `domain/value-objects/{money,float-percent-schedule}.value-object.ts`,
      `domain/entities/accounting-period/accounting-period.entity.ts`,
      `domain/entities/salary-accrual/salary-accrual.entity.ts`,
      `application/command/accounting-period/{close,reopen}-accounting-period.handler.ts`,
      `application/services/calculation/resolve-employee-salary-rules.service.ts`,
      `application/services/salary-report/get-employee-salary-report.service.ts` — заменены на
      `spec: shop/accounting#<anchor>` (25 ссылок). Архитектурные/имплементационные пояснения
      (DI-токены, зеркалирование структуры сервисного модуля, issue-номера) не тронуты.
      `get-department-salary-report.service.ts` и `cashbox`/`salary-accrual`-командах выплаты
      (`create-payout*`, `delete-payout`) — вне этой задачи (первый не содержит явного
      предложения-объяснения, совпадающего с формулировкой какого-либо Requirement; второе — вне
      scope капабилити, см. Purpose спека).
- [x] 6.3 Прогнать `npm run test -- --testPathPatterns=domains/shop/modules/accounting` — тесты
      остаются зелёными после зачистки комментариев. Результат: 33/33 suites, 204/204 tests.
- [x] 6.4 Прогнать `npm run validate:specs` на `backend/src/domains/shop/modules/accounting` — все
      добавленные ссылки резолвятся без ошибок. Результат: `OK: проверено 25 spec-ссылок`.

## 7. Итоговая проверка change

- [x] 7.1 `openspec validate shop-domain-docs-migration-to-openspec --strict` без ошибок. Результат:
      `Change 'shop-domain-docs-migration-to-openspec' is valid`.
- [x] 7.2 `eslint` без предупреждений на всех файлах, затронутых разделами 2–6 (26 файлов). Результат:
      без вывода — 0 предупреждений/ошибок.
- [x] 7.3 Полный прогон `npm run test -- --testPathPatterns=domains/shop/(modules/(warehouse|
      marketing|sales|accounting)|sync/moySklad)` одним финальным прогоном — убедиться, что ни одна
      из пяти зачисток не повлияла на смежные модули (в частности, `modules/accounting`, зависящий от
      `modules/sales` через `SHOP_SALES_PERFORMANCE_READER`). Результат: 62/62 suites, 360/360 tests.
- [x] 7.4 Убедиться, что все пункты "не покрыто тестами", зафиксированные в `Test Coverage Notes`
      спеков, по-прежнему актуальны на момент завершения change: полная замена позиций отгрузки и
      докатка placeholder/услуги в `uploadDemand` — по-прежнему без прямого теста; курсор докатки
      крона МойСклад и переоткрытие периода shop (`reopen-accounting-period.handler.ts`) — по-прежнему
      без прямого теста. Пункт про отсутствие вызова обновления МойСклад в импорте цен — **больше не
      актуален**: по решению пользователя (см. раздел 3, задача 3.0) вызов раскомментирован, спек
      `shop/marketing` и его Test Coverage Notes обновлены под новое, полностью покрытое тестом
      поведение — старый пробел закрыт, а не тихо забыт.
- [x] 7.5 (обнаружено при apply, вне исходного плана) `application/command/start-price-import.handler.ts:91`
      — раскомментирован вызов `updateMoySklad()`, единственная правка этого change, затрагивающая
      наблюдаемое поведение production-кода (см. раздел 3, задача 3.0, и proposal.md → Impact).

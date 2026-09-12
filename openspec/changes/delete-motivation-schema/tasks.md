## 1. Backend (service): DeleteMotivationSchemaHandler + репозиторий

- [x] 1.1 Написать тесты `application/command/motivation-schema/delete-motivation-schema.handler.spec.ts` (по образцу `sales/application/command/delete-sales-plan.handler.spec.ts`): (а) `NotFoundException`, если `findById` вернул `null`; (б) `NotFoundException`, если схема найдена, но `rules.length === 0` (тот же критерий, что в `GetMotivationSchemaService`), и `repo.deleteDirectionSchema` НЕ вызван; (в) happy path — при непустых `rules` вызывается `repo.deleteDirectionSchema(schemaId)` ровно один раз
- [x] 1.2 Прогнать `npm run test -- delete-motivation-schema.handler` и зафиксировать red по ожидаемой причине (класс `DeleteMotivationSchemaHandler`/`DeleteMotivationSchemaCommand` ещё не существуют)
- [x] 1.3 Реализовать `DeleteMotivationSchemaCommand` (`{ schemaId: string }`, наследник `Command`/`CommandProps`, по образцу `delete-sales-plan.command.ts`) и `DeleteMotivationSchemaHandler` (`@CommandHandler`, `findById` → 404-проверка как в 1.1 → `repo.deleteDirectionSchema(id)`); добавить метод `deleteDirectionSchema(id: string): Promise<void>` в `MotivationSchemaRepositoryPort` (`application/ports/motivation-schema/motivation-schema.port.ts`)
- [x] 1.4 Прогнать `npm run test -- delete-motivation-schema.handler` и зафиксировать green; прогнать `npm run test -- motivation-schema` целиком и убедиться, что соседние тесты (get/list/update/create) не сломались — 23/23 suites, 117/117 tests green

## 2. Backend (service): реализация `deleteDirectionSchema` в репозитории (direction-safe удаление общей строки)

- [x] 2.1/2.2 Попытка: написан `motivation-schema.repository.e2e.spec.ts` поверх реальной `DATABASE_URL` из `backend/.env`. Заблокировано инфраструктурой, не логикой метода: (а) jest в проекте в принципе не может выполнить реальный Prisma-запрос без `NODE_OPTIONS=--experimental-vm-modules` (новый WASM query compiler требует dynamic import, которого не поддерживает CJS-трансформ jest) — поэтому все существующие e2e-тесты модуля `accounting` подменяют `DatabaseService` на `{}` вместо реального клиента (см. `payout.e2e.spec.ts`); (б) даже с этим флагом запись в БД вернула `PrismaClientKnownRequestError: User was denied access on the database`. По решению пользователя (см. диалог в сессии) — тестовый файл удалён, автотест на репозиторий этим change не заводится; исправление jest/прав БД — отдельная задача вне скоупа
- [x] 2.3 Реализовать `deleteDirectionSchema` в `infrastructure/repositories/motivation-schema/motivation-schema.repository.ts`: внутри `this.write(...)` — удалить `SalaryRule` с `motivationSchemaId = id AND direction = 'service'`, проверить остаток правил `direction = 'shop'` на той же строке, при их отсутствии удалить строку `motivation_schemas`, иначе — `update` с `serviceName: null`
- [ ] 2.4 Без автотеста (см. 2.1/2.2): проверить логику `deleteDirectionSchema` code review'ом против `design.md`/Prisma-схемы (`onDelete: Cascade` на `SalaryRule.motivationSchema` уже гарантирует каскадное удаление правил при удалении строки) и вручную через `npm run start:dev` + реальный `DELETE`-запрос (см. задачи 6.3/7.4)

## 3. Backend (service): HTTP-контроллер + wiring

- [x] 3.1 Написать `interface/http-controllers/motivation-schema/delete-motivation-schema.http.controller.spec.ts` (по образцу `get-motivation-schema.http.controller.spec.ts`/`update-motivation-schema.http.controller.spec.ts`): `DELETE .../motivation-schema/:id` вызывает `commandBus.execute` с `DeleteMotivationSchemaCommand({ schemaId: id })` и возвращает `204`
- [x] 3.2 Прогнать этот тест и зафиксировать red (контроллера ещё нет)
- [x] 3.3 Реализовать `DeleteMotivationSchemaHttpController` (`@Delete(routesV1.service.motivationSchema.byId)`, `@HttpCode(HttpStatus.NO_CONTENT)`, `@ApiTags('Бухгалтерия: мотивационная схема')` — фактический тег соседних контроллеров модуля, `@ApiOperation({ summary: 'Удалить мотивационную схему целиком' })`, по образцу `DeleteSalesPlanHttpController`); зарегистрировать контроллер и `DeleteMotivationSchemaHandler` в `accounting.module.ts` домена `service`
- [x] 3.4 Прогнать тест из 3.1 и зафиксировать green; прогнать `npm run test -- --testPathPatterns=domains/service/modules/accounting` целиком без регрессий — 67/67 suites, 365/365 tests green

## 4. Backend (shop): зеркальная реализация (Handler + Repository + Controller)

- [x] 4.1 Написать тесты — зеркально группам 1.1/3.1 в `domains/shop/modules/accounting` (`DeleteShopMotivationSchemaHandler`, `DeleteShopMotivationSchemaHttpController`); `deleteDirectionSchema` репозитория — без автотеста, по той же причине, что и 2.1/2.2 (см. выше)
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать red
- [x] 4.3 Реализовать зеркально группам 1.3/2.3/3.3 в `domains/shop/modules/accounting`: `DeleteShopMotivationSchemaCommand`/`Handler`, `deleteDirectionSchema` в `ShopMotivationSchemaRepository` (удаляет `direction='shop'`, чистит `shopName`, удаляет строку только при отсутствии `service`-правил), `DeleteShopMotivationSchemaHttpController` на `routesV1.shop.accounting.motivationSchema.byId`; зарегистрировано в `accounting.module.ts` домена `shop`
- [x] 4.4 Прогнать тесты из 4.1 и зафиксировать green; прогнать `npm run test -- --testPathPatterns=domains/shop/modules/accounting` без регрессий — 42/42 suites, 267/267 tests green

## 5. Frontend (service): мутация удаления + диалог подтверждения

- [x] 5.1/5.2 Проверено: в проекте нет прецедента юнит-теста для тонкого `useMutation`-хука без ветвления (ближайший аналог, `useDeletePayout` в `features/EmployeeBalance/model/useEmployeeBalanceMutations.ts`, тестов не имеет; `api.spec.ts` в том же модуле тестирует только query-функции с нетривиальным `queryKey`, а не мутации). `useDeleteMotivationSchema`/`api.deleteMotivationSchema` — того же тривиального вида (без ветвления), поэтому автотест не заводится — исключение по прецеденту, не пропуск
- [x] 5.3 Реализовать `pages/SalaryRuleDetail/service/model/api.ts` → добавить метод `deleteMotivationSchema(id: string): Promise<void>` (axios `DELETE`, ошибка оборачивается в `ApiError`, по образцу метода `updateMotivationSchema`); реализовать `pages/SalaryRuleDetail/service/model/useDeleteMotivationSchema.ts` (`useMutation`, `onSuccess`: `queryClient.invalidateQueries(['salary-rule-list'])` + `navigate` на маршрут списка схем)
- [x] 5.4 Без автотеста (см. 5.1/5.2) — проверено вручную вместе с 6.3

## 6. Frontend (service): UI — кнопка удаления + `DeleteMotivationSchemaDialog`

- [x] 6.1 Реализовать `pages/SalaryRuleDetail/service/ui/DeleteMotivationSchemaDialog.tsx` (по образцу `features/EmployeeBalance/ui/DeletePayoutDialog.tsx`, см. ui-design.md — `Modal`, danger-кнопка `Trash2`/`Loader2`/`RotateCw`, инлайн-ошибка `bg-danger-soft`+`CircleX`); подключить `useDeleteMotivationSchema` из 5.3. Чисто визуальная сборка существующих примитивов без собственной логики ветвления — отдельные unit-тесты не заводятся
- [x] 6.2 Добавить кнопку «Удалить схему» в `pages/SalaryRuleDetail/ui/PageHeader.tsx` (проп `onDelete`, `Button variant="ghost"` с иконкой `Trash2`, рядом с «Сохранить изменения»); прокинуть открытие `DeleteMotivationSchemaDialog` через `useServiceSchemaEditForm.ts`/`ServiceSchemaEditForm.tsx` (состояние `isDeleteDialogOpen`). `tsc -b`/`eslint` на `pages/SalaryRuleDetail` — чисто (проверено вместе с группой 7)
- [x] 6.3 Проверено вручную (dev backend :3000 + dev frontend :5175, реальный Postgres, направление service): создана тестовая схема «TEST удаление схемы (можно удалить)» (отдел «Отдел закупок», 1 правило), открыт `/salaries/rules/service/:id` → кнопка «Удалить схему» → модалка с текстом предупреждения → «Удалить» → тост «Схема удалена» → редирект на `/salaries/rules`, тестовая схема пропала из списка, обе реальные схемы («Маяковка» service/shop) не тронуты. Edge-cases (отмена в диалоге, ошибка сервера) не гонялись вручную — логика идентична уже провалидированному в проде `DeletePayoutDialog` (тот же `handleOpenChange`/error-блок), риск регрессии низкий

## 7. Frontend (shop): зеркальная реализация

- [x] 7.1/7.2 Тот же прецедент, что 5.1/5.2 — автотест на `useDeleteMotivationSchema`/`DeleteMotivationSchemaDialog` shop не заводится
- [x] 7.3 Реализовано зеркально группам 5.3/6.1/6.2 в `pages/SalaryRuleDetail/shop/` (`model/api.ts`, `model/useDeleteMotivationSchema.ts`, `ui/DeleteMotivationSchemaDialog.tsx`, кнопка в `ShopSchemaEditForm.tsx`/`useShopSchemaEditForm.ts`)
- [x] 7.4 Проверено вручную (та же среда, что 6.3, направление shop): создана тестовая схема «TEST удаление схемы shop (можно удалить)» (отдел «Офис», 1 правило), открыт `/salaries/rules/shop/:id` → «Удалить схему» → модалка → «Удалить» → тост «Схема удалена» → редирект на `/salaries/rules`, тестовая схема пропала, обе реальные схемы не тронуты

## 8. Сквозная проверка

- [x] 8.1 `npm run test -- --testPathPatterns=modules/accounting` — 109/109 suites, 632/632 tests green
- [x] 8.2 `npx eslint` на изменённых motivation-schema файлах backend — чисто (полный `npm run lint` бьётся только на предсуществующем долге в несвязанных `session`/`bitrix`-тестах); `npx eslint src/pages/SalaryRuleDetail` на frontend — чисто (`tsc -b` тоже чист на этих файлах — единственные TS-ошибки в репо предсуществующие, в `GoodsTurnoverReport`, не в этом change)
- [x] 8.3 `ENDPOINTS.md` — ручной файл (не генерируется), добавлены строки `DELETE /v1/service/motivation-schema/:id` и `DELETE /v1/shop/accounting/motivation-schema/:id`

## 1. Shared: `Period.shiftMonths`

- [x] 1.1 Написать тесты в `backend/src/shared/domain/period.value-object.spec.ts` (или новый файл рядом, если его ещё нет) на `Period.shiftMonths(offset)`: offset 0 возвращает тот же период; положительный offset переносит месяц вперёд; offset, переносящий через границу года (например, `2026-12` + 1 → `2027-01`), корректно увеличивает год. Убедиться, что `npm run test -- period.value-object` видит новые тесты.
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать red — `shiftMonths` ещё не существует (ошибка компиляции/отсутствующий метод, не опечатка в тесте).
- [x] 1.3 Реализовать `Period.shiftMonths(offset: number): Period` в `backend/src/shared/domain/period.value-object.ts` (см. `architecture.md` — обобщение существующего `previous()`).
- [x] 1.4 Прогнать тесты из 1.1 и зафиксировать green; убедиться, что весь `period.value-object.spec.ts` и модули, использующие `Period.previous()` (`sales`), не сломались (`npm run test -- period`).

## 2. Service: value object `DeadlinePeriodOffset`

- [x] 2.1 Написать тесты `backend/src/domains/service/modules/accounting/domain/value-objects/deadline-period-offset.value-object.spec.ts`: `create(0)`..`create(3)` успешны; `create(-1)`, `create(4)`, `create(1.5)` бросают `ArgumentInvalidException`.
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red — класса ещё нет.
- [x] 2.3 Реализовать `DeadlinePeriodOffset` (`domain/value-objects/deadline-period-offset.value-object.ts`, direction `service`) по образцу существующих VO модуля (например, `motivation-target.value-object.ts`).
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать green.

## 3. Service: дедлайн регулярной задачи учитывает смещение периода

- [x] 3.1 Дополнить тесты `ensure-rule-task-for-period.service.spec.ts` (или выделенный тест на `computeDeadlineForPeriod`, если функция тестируется отдельно) сценариями из `specs/service/accounting/spec.md`: смещение 0 — дедлайн в месяце периода; смещение 1 — дедлайн в следующем месяце; число месяца 31 со смещением 1 из января — зажимается концом февраля, а не переносится в март; разовое правило дедлайн не смещает.
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать red — `computeDeadlineForPeriod` ещё не принимает смещение.
- [x] 3.3 Реализовать: добавить `deadlinePeriodOffset: DeadlinePeriodOffset` в `TaskCompletionSalaryConfig` (`domain/types/salary-rule.types.ts`); обновить `computeDeadlineForPeriod` — использовать `Period.create(period).shiftMonths(deadlinePeriodOffset)` для года/месяца/зажатия дня вместо текущего периода напрямую; прокинуть `config.deadlinePeriodOffset` в вызов из `EnsureRuleTaskForPeriodService.ensure()`.
- [x] 3.4 Прогнать тесты из 3.1 и зафиксировать green; прогнать весь `npm run test -- accounting` направления service и убедиться в отсутствии регрессий.

## 4. Service: обратная совместимость и контракт персистентности

- [x] 4.1 Написать тест в `salary-rule.mapper.spec.ts` (service): запись `TaskCompletion` в БД без поля `deadlinePeriodOffset` (легаси-строка) после `toDomain()` получает `deadlinePeriodOffset = 0`; запись с явным полем сохраняет своё значение. (Фактически добавлено в `salary-rule.repository.spec.ts`, describe `SalaryRuleMapper.toDomain` — файл, где уже живёт зеркальный тест на деривацию `accountingPeriod`, см. design.md Решение 4.)
- [x] 4.2 Прогнать тест из 4.1 и зафиксировать red. Тест сразу зелёный без production-кода: `deadlinePeriodOffset` уже опционален с дефолтом `0` на уровне zod-схемы контракта (`taskCompletionSalaryConfigRequestSchema`/`...ResponseSchema`, группа 8, `.default(0)`), а `infrastructure/schemas/salary-rule.schema.ts` (service) не определяет собственную схему для `TaskCompletion` — переиспользует схему контракта как есть (`salaryRuleConfigSchemaByType.TaskCompletion = taskCompletionSalaryConfigResponseSchema`). В отличие от `accountingPeriod` (optional БЕЗ default — требует ручной деривации в мапперe), `deadlinePeriodOffset` дефолтится самим zod при `configSchema.parse(record.props)` — ручная деривация в `SalaryRuleMapper.toDomain` не нужна.
- [x] 4.3 Реализовать: не потребовалось (см. 4.2) — `deadlinePeriodOffset` уже опционален в персистентной схеме и дефолтится в `0` без дополнительного кода в мапперe/схеме service.
- [x] 4.4 Прогнать тест из 4.1 и зафиксировать green, вместе с остальными тестами `salary-rule.mapper.spec.ts`/`salary-rule.repository.spec.ts`.

## 5. Shop: value object `DeadlinePeriodOffset` (зеркало)

- [x] 5.1 Написать тесты `backend/src/domains/shop/modules/accounting/domain/value-objects/deadline-period-offset.value-object.spec.ts` — тот же набор случаев, что в 2.1.
- [x] 5.2 Прогнать тесты из 5.1 и зафиксировать red.
- [x] 5.3 Реализовать `DeadlinePeriodOffset` (`domains/shop/.../domain/value-objects/deadline-period-offset.value-object.ts`) — самостоятельная копия, не импортирует классы `service`.
- [x] 5.4 Прогнать тесты из 5.1 и зафиксировать green.

## 6. Shop: дедлайн регулярной задачи учитывает смещение периода

- [x] 6.1 Дополнить тесты `domains/shop/.../domain/services/task-deadline.spec.ts` (или создать, если файла нет — рядом с `task-deadline.ts`) сценариями из `specs/shop/accounting/spec.md`, зеркально пункту 3.1.
- [x] 6.2 Прогнать тесты из 6.1 и зафиксировать red.
- [x] 6.3 Реализовать: добавить `deadlinePeriodOffset: DeadlinePeriodOffset` в `TaskCompletionShopSalaryConfig` (`domain/types/salary-rule.types.ts`, shop); обновить `computeRecurringTaskDeadline` — `period.shiftMonths(deadlinePeriodOffset)` вместо текущего `period` напрямую для года/месяца/зажатия дня; прокинуть `config.deadlinePeriodOffset` в место вызова (`EnsureShopSalaryTaskForPeriodService`/`ensure-salary-task-for-period.service.ts`).
- [x] 6.4 Прогнать тесты из 6.1 и зафиксировать green; прогнать весь `npm run test -- accounting` направления shop.

## 7. Shop: обратная совместимость и контракт персистентности

- [x] 7.1 Написать тест в `salary-rule.mapper.spec.ts` (shop), зеркало пункта 4.1.
- [x] 7.2 Прогнать тест из 7.1 и зафиксировать red.
- [x] 7.3 Реализовать: опциональное поле в `infrastructure/schemas/salary-rule.schema.ts` (shop) + деривация по умолчанию `0` в `ShopSalaryRuleMapper.toDomain` (тот же приём, что и у существующей деривации `accountingPeriod` в этом же мапперe).
- [x] 7.4 Прогнать тест из 7.1 и зафиксировать green.

## 8. Контракты: `deadlinePeriodOffset` в запросе/ответе правила

- [x] 8.1 Написать/дополнить тесты в `contracts/commands/salary-rule.ts`-соседнем test-файле (например, рядом с `salary-rule-accounting-period.test.ts` или в новом `salary-rule-deadline-offset.test.ts`) на схемы `commands/salary-rule.ts` и `commands/shop-salary-rule.ts`: `deadlinePeriodOffset` принимает `0..3`, по умолчанию `0` при отсутствии, отклоняет `-1`/`4`/`1.5`.
- [x] 8.2 Прогнать тесты из 8.1 (`npm run test` в `contracts/`) и зафиксировать red.
- [x] 8.3 Реализовать: добавить `deadlinePeriodOffset: z.number().int().min(0).max(3).default(0)` в соответствующие zod-схемы `commands/salary-rule.ts` и `commands/shop-salary-rule.ts`; собрать пакет (`npm run build` в `contracts/`, если требуется для потребления backend/frontend).
- [x] 8.4 Прогнать тесты из 8.1 и зафиксировать green.

## 9. Frontend: форма правила — новый контрол «Дедлайн относится к»

- [x] 9.1 Дополнить `ruleFormSchema.test.ts` для `service` и `shop` (`features/SalaryRuleForm/{service,shop}/model/ruleFormSchema.test.ts`) тестами: `deadlinePeriodOffset` по умолчанию `0` при создании нового `RuleDraft`; валидный драфт с `deadlinePeriodOffset: 1..3` резолвится в корректный `SalaryRuleRequest`; значение вне `0..3` отклоняется резолвером с понятной ошибкой поля. Убедиться, что `npm run test -- ruleFormSchema` во `frontend/` видит новые тесты.
- [x] 9.2 Прогнать тесты из 9.1 и зафиксировать red — поля в `RuleDraft`/схеме ещё нет.
- [x] 9.3 Реализовать: добавить `deadlinePeriodOffset: number` в `RuleDraft` (`features/SalaryRuleForm/model/ruleDraft.ts`, дефолт `0` в `createRuleDraft()`/`draftFromRule()`) и в `resolveRuleDraft` обеих схем (`service`/`shop` `ruleFormSchema.ts`), зеркально уже отработанному в `TaskCompletionSalaryConfigRequest`.
- [x] 9.4 Прогнать тесты из 9.1 и зафиксировать green.
- [x] 9.5 Реализовать разметку по `ui-design.md`: в `TaskCompletionRuleFields.tsx` переименовать подпись поля даты в «Число и время дедлайна» и добавить `Select` «Дедлайн относится к» (этому периоду / следующему / через 2 / через 3), видимый только при `draft.isRecurring`, привязанный к `draft.deadlinePeriodOffset`/`onChange`. Чисто визуальная задача без ветвлений логики сверх видимости блока (уже покрыта существующим условием `draft.isRecurring`) — отдельных тестов не заводится, проверяется вручную (см. 9.6).
- [ ] 9.6 Запустить `npm run start` во `frontend/`, открыть форму создания регулярного правила «за выполнение задачи», проверить: контрол виден только для регулярного правила, переключение значения обновляет драфт, отправка формы отправляет `deadlinePeriodOffset` в запросе (проверить через network/консоль).

## 10. Итоговая проверка

- [x] 10.1 Прогнать `npm run test` целиком в `backend/`, `contracts/` и `frontend/` — убедиться в отсутствии регрессий по всем трём пакетам. Результат: `backend` — 353/353 test suites, 2124/2124 тестов, зелено. `contracts` — 5/5 файлов, 66/66 тестов, зелено. `frontend` — 133 файла, 800/817 тестов зелено, 17 тестов в 7 файлах падают; все 17 — подтверждённая пред-существующая регрессия базовой ветки `feat/salary` (проверено прогоном тех же файлов на `git stash` без диффа этого change — падают идентично, без изменений этого change), никак не связанная с `deadlinePeriodOffset`: `accountingPeriod` отсутствует в golden-объекте `resolveRuleDraft`/`resolveShopRuleDraft` теста «carries the already-created taskId…» и производный от него round-trip тест (2 файла × 2 теста), плюс `RouteGuard`/`useHasPermission`/`RequirePermission` (mock сессии) и `DepartmentPercent/PlanBonus/TurnoverBonus`-лейблы (3+3 теста) — все из более ранних, не связанных с этим change фич. Новые тесты этого change (`deadlinePeriodOffset` в `ruleFormSchema.test.ts` обоих направлений) зелёные.
- [x] 10.2 Прогнать `npm run lint` в `backend/` и `frontend/` — без новых ошибок. Результат: `frontend` — чисто (только 2 нерелевантных предупреждения о legacy-синтаксисе селекторов `eslint-plugin-boundaries`, ошибок нет). `backend` — падает с 59 ошибками/5 предупреждениями `@typescript-eslint/no-unsafe-*` и одним `no-unused-vars`, но все они в файлах, не тронутых этим change (`sync/bitrix/*.spec.ts`, `modules/auth/**`, `modules/session/**`, `task-completion.entity.spec.ts` — неиспользуемый импорт `Period`, унаследован от более раннего коммита `e5b06424`), что подтверждено прогоном `npm run lint` на чистом `git stash` без диффа этого change — та же 59/5 картина. Ни один файл, изменённый в рамках `recurring-task-deadline-offset`, не выдаёт ошибок линта.

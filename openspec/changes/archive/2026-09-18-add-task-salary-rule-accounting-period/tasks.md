## 1. Contracts — поле `accountingPeriod` в схемах TaskCompletion (service + shop)

- [x] 1.1 Написать тест(ы) в `contracts/commands/` (vitest, новый файл `salary-rule-accounting-period.test.ts` или дополнение существующего `salary-rule-task-panel.test.ts`): `taskCompletionSalaryConfigRequestSchema`/`taskCompletionShopSalaryConfigRequestSchema` требуют `accountingPeriod` в формате `YYYY-MM` (валидный принимается, отсутствующий/некорректный формат — `ZodError`); `taskCompletionSalaryConfigResponseSchema`/`taskCompletionShopSalaryConfigResponseSchema` принимают как наличие, так и отсутствие `accountingPeriod` (обратная совместимость со старыми персистированными строками) — убедиться, что `npx vitest run` видит новые тесты
- [x] 1.2 Прогнать тесты из 1.1 и зафиксировать, что они падают (red) — поля `accountingPeriod` в схемах ещё нет
- [x] 1.3 Добавить `accountingPeriod: z.string().regex(PERIOD_REGEX)` в `taskCompletionSalaryConfigRequestSchema` (`contracts/commands/salary-rule.ts`) и `taskCompletionShopSalaryConfigRequestSchema` (`contracts/commands/shop-salary-rule.ts`) как обязательное поле; в обеих response-схемах (`taskCompletionSalaryConfigResponseSchema`/`taskCompletionShopSalaryConfigResponseSchema`) — как `.optional()` (design.md, Decision 1)
- [x] 1.4 Прогнать тесты из 1.1 и зафиксировать, что они зелёные (green); прогнать весь `contracts` тест-сьют (`npm run test` в `contracts/`) и убедиться, что регрессий нет

## 2. Backend (service) — domain: явный период при создании правила

- [x] 2.1 В `backend/src/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity.spec.ts` написать тест(ы): `buildTaskCompletionConfig(request, existing)` кладёт `request.taskId` в `taskIdByPeriod` под ключом `request.accountingPeriod` (а не `Period.current()`) и возвращает `config.accountingPeriod === request.accountingPeriod`; некорректный формат периода в запросе приводит к исключению домена (не тихо принимается)
- [x] 2.2 Прогнать тесты из 2.1 и зафиксировать red — `buildTaskCompletionConfig` всё ещё использует `Period.current()`
- [x] 2.3 Обновить `TaskCompletionSalaryConfig` (`domain/types/salary-rule.types.ts`, поле `accountingPeriod: string`) и `buildTaskCompletionConfig` (`task-completion.entity.ts`) — использовать `request.accountingPeriod` (через `Period.create(...)` для валидации формата) вместо `Period.current()`
- [x] 2.4 Прогнать тесты из 2.1 и зафиксировать green; прогнать весь спек-файл и соседние тесты модуля `accounting` (`npm run test -- domains/service/modules/accounting`), убедиться в отсутствии регрессий

## 3. Backend (service) — infrastructure: совместимость с уже персистированными правилами

- [x] 3.1 В `backend/src/domains/service/modules/accounting/infrastructure/repositories/motivation-schema/salary-rule.repository.spec.ts` написать тест(ы) на `SalaryRuleMapper.toDomain`: строка `SalaryRule` с `props` без `accountingPeriod`, но с непустым `taskIdByPeriod` → домен получает `accountingPeriod`, равный максимальному (лексикографически, формат `YYYY-MM`) ключу карты; `props` с пустым `taskIdByPeriod` и без `accountingPeriod` → `Period.current()`; `props` с уже заполненным `accountingPeriod` → значение передаётся как есть
- [x] 3.2 Прогнать тесты из 3.1 и зафиксировать red — деривации ещё нет, парсинг актуальной схемы (см. группу 1) либо падает, либо не заполняет поле
- [x] 3.3 Реализовать деривацию в `SalaryRuleMapper.toDomain` (`salary-rule.repository.ts`)
- [x] 3.4 Прогнать тесты из 3.1 и зафиксировать green; прогнать `salary-rule.repository.spec.ts` целиком и соседние тесты `accounting`, регрессий нет

## 4. Backend (service) — application: обновление периода при автосоздании задачи

- [x] 4.1 В `backend/src/domains/service/modules/accounting/application/services/task-completion/ensure-rule-task-for-period.service.spec.ts` написать тест(ы): `ensure()` при создании НОВОЙ задачи на период `P` (регулярное правило, задачи периода `P` ещё нет) устанавливает `config.accountingPeriod = P` перед `ruleRepo.update(rule)`; идемпотентный ранний возврат (задача периода `P` уже существует) НЕ меняет `config.accountingPeriod`
- [x] 4.2 Прогнать тесты из 4.1 и зафиксировать red
- [x] 4.3 Реализовать в `EnsureRuleTaskForPeriodService.ensure()` — мутацию `config.accountingPeriod = period` в той же точке, где уже мутируется `config.taskIdByPeriod[period]`
- [x] 4.4 Прогнать тесты из 4.1 и зафиксировать green; прогнать также `task-completion-auto-creation.cron.spec.ts` и специи `get-employee-salary-report.service.spec.ts`/`get-department-salary-report.service.spec.ts` (используют `ensure()` через мок/стаб) — регрессий нет

## 5. Backend (shop) — зеркальные изменения (domain / infrastructure / application)

- [x] 5.1 Написать тест(ы), зеркальные группам 2–4, в `domains/shop/modules/accounting`: `task-completion.entity.spec.ts` (явный `accountingPeriod` в `buildTaskCompletionConfig`/аналоге), `salary-rule.repository.spec.ts` (деривация в мапере для легаси-строк), `ensure-salary-task-for-period.service.spec.ts` (`EnsureShopSalaryTaskForPeriodService.ensure()` обновляет `accountingPeriod` только при создании новой задачи)
- [x] 5.2 Прогнать тесты из 5.1 и зафиксировать red
- [x] 5.3 Реализовать зеркальные изменения в `domains/shop/modules/accounting/domain/types/salary-rule.types.ts`, `domain/entities/salary-rules/task-completion.entity.ts`, `infrastructure/repositories/motivation-schema/salary-rule.repository.ts`, `application/services/salary-task/ensure-salary-task-for-period.service.ts` (shop не имеет собственного крона — только ленивый путь, design.md Non-Goals)
- [x] 5.4 Прогнать тесты из 5.1 и зафиксировать green; прогнать весь `domains/shop/modules/accounting` тест-сьют, регрессий нет

## 6. Backend — обновление существующих e2e-сценариев (регрессия, без нового поведения)

- [x] 6.1 Обновить тела запросов создания правила `TaskCompletion` в существующих e2e-тестах — добавить `accountingPeriod` (`task-completion-lifecycle.e2e.spec.ts`, `salary-rule-task-lookup.e2e.spec.ts` в `service`, и их аналоги в `shop`) — это задачи поддержания уже описанного контрактом поведения (группа 1 уже покрывает отклонение запроса без `accountingPeriod` тестом на уровне схемы), отдельного TDD-цикла не требуется; прогнать `npm run test:e2e` и убедиться, что все сценарии проходят зелёным без регрессий

## 7. Frontend — `SalaryRuleForm`: поле `accountingPeriod` в драфте и резолверах

- [x] 7.1 Добавить `accountingPeriod: string` в `RuleDraft` (`frontend/src/features/SalaryRuleForm/model/ruleDraft.ts`), предзаполнять текущим периодом в `createRuleDraft()`/`resetAwardFields()` (design.md, Decision 4); для уже существующего правила — брать значение из ответа API (`draftFromRule`/`draftFromShopRule`) вместо пересчёта. Тестового раннера на frontend нет (`frontend/CLAUDE.md`: «Тестовый раннер в package.json не настроен»), поэтому шаги 1/2/4 TDD опускаются — верификация вручную (см. группу 9) и через `tsc -b`
- [x] 7.2 Добавить `accountingPeriod: draft.accountingPeriod` в собираемый `TaskCompletion`-config в `service/model/ruleFormSchema.ts` и `shop/model/ruleFormSchema.ts` (резолверы `resolveRuleDraft`/`resolveShopRuleDraft`), с обязательной валидацией (пустое/некорректное значение → `errors.accountingPeriod`, по аналогии с существующим `errors.taskId`) — проверить через `tsc -b` в `frontend/`, что типы совпадают с обновлённым контрактом (группа 1)

## 8. Frontend — UI: `PeriodPicker` в карточке правила `TaskCompletion`

- [x] 8.1 Добавить в `TaskCompletionRuleFields.tsx` блок выбора периода компонентом `PeriodPicker` (`shared/ui-kit/organisms/PeriodPicker.tsx`), видимый всегда (не только при `isRecurring`, design.md Decision 4), рядом с блоком «Задача»; вывод ошибки — `FieldError` с `errors.accountingPeriod` (тот же паттерн, что и у соседних полей карточки). Чисто визуальное изменение без новой ветвящейся логики за пределами уже покрытого группой 7 резолвера — TDD-шаги опускаются по той же причине, что и в 7.1

## 9. Ручная проверка (frontend + интеграция)

- [ ] 9.1 Через скилл `/run` запустить приложение, открыть форму создания зарплатного правила «За выполнение задачи» (service), убедиться: поле периода отображается и предзаполнено текущим периодом, создание разового и регулярного правила с явно выбранным периодом проходит успешно, значение видно при повторном открытии/редактировании правила; повторить для направления `shop`
- [ ] 9.2 Убедиться (через `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService` — вызвать зарплатный отчёт сотрудника за период, следующий за периодом регулярного правила, что триггерит ленивый `ensure()`), что `accountingPeriod` правила обновился на новый период после автосоздания задачи — проверить значение в ответе `GET /v1/service/accounting/motivation-schema` (или аналогичном) до и после запроса отчёта

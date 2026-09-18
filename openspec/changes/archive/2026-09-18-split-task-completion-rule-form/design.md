## Context

См. proposal.md - Why. Технический контекст (см. отчёт исследования кода, не повторяю тут дословно):

- `TaskCompletionRuleFields.tsx` — сейчас одна форма: `taskId` (только для чтения, заполняется из
  `CreateTaskPanel`) и `accountingPeriod` показываются всегда; блок шаблона
  (`taskTitleTemplate`/`deadlineTemplate`/`deadlinePeriodOffset`/`taskDescriptionTemplate`/
  `taskLinkTemplates`) — только при `isRecurring === true`. Переключатель «Разовая/Регулярная»
  находится в середине формы, между `accountingPeriod` и блоком шаблона.
- `ruleFormSchema.ts` (`resolveRuleDraft`, ветка `TaskCompletion`) требует `taskId` и
  `accountingPeriod` всегда, независимо от `isRecurring`; поля шаблона — только при `isRecurring`.
- Контракт `taskCompletionSalaryConfigRequestSchema` (`contracts/commands/salary-rule.ts`) объявляет
  `taskId` безусловно обязательным полем.
- `EnsureRuleTaskForPeriodService.ensure(rule, period, assigneeEmployeeId)` (service-домен, возвращает
  `Promise<string | null>`) и его shop-аналог `EnsureShopSalaryTaskForPeriodService.ensure(salaryRuleId, period, assigneeEmployeeId)`
  уже умеют идемпотентно создавать задачу нового периода из шаблона регулярного правила (диспатчат
  `CreateTaskCommand` в модуль `tasks`) — но сегодня этот механизм вызывается только лениво, из
  `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService` при формировании зарплатного
  отчёта за период, а не при создании правила и не по расписанию.
- `CreateSalaryRuleHandler` (`.../application/command/motivation-schema/create-salary-rule.handler.ts`,
  и shop-аналог `CreateShopSalaryRuleHandler`) сейчас просто собирает entity через `SalaryRuleFactory.create()`
  из уже готового payload (включая присланный `taskId`) и сохраняет её через `SalaryRuleRepositoryPort.insert()`
  — никакой сервис создания задачи не вызывает.
- `TaskCompletion.create()` — доменная фабрика, которая просто кладёт уже присланный `taskId` в
  `config.taskIdByPeriod[accountingPeriod]`; сама задачу не создаёт.

## Goals / Non-Goals

**Goals:**
- Развести разовый и регулярный сценарии на уровне UI (какие поля показываются) и контракта (какие
  поля обязательны), не меняя ни одной другой возможности правила «за выполнение задачи» (дедлайн-
  смещение, отображение в отчёте, деактивация разового правила и т.д.).
- Убрать необходимость создавать первую задачу регулярного правила вручную через панель задач —
  переиспользовать существующий `EnsureRuleTaskForPeriodService` (и shop-аналог) на этапе создания
  правила, а не только при переходе периода.
- Сделать выбор расчётного периода и (для разового правила) суммы начисления явной частью шага
  «задача», а не отдельными полями где-то ещё в форме.

**Non-Goals:**
- Не меняется бэкенд-модель хранения (`config.taskIdByPeriod` остаётся как есть); никакой новой
  сущности или таблицы не вводится.
- Не меняется поведение уже существующих правил (переключение `isRecurring` после создания правила,
  автопересоздание задачи по периодам, деактивация разового правила) — это отдельные открытые changes
  (`recurring-task-deadline-offset`, `deactivate-one-off-task-completion-rule`).
- Не вводится выбор задачи из списка уже существующих задач — задача по-прежнему создаётся заново
  через `CreateTaskPanel`, как сейчас.
- «Список периодов» из формулировки задачи — это picker для выбора ОДНОГО расчётного периода (как
  сейчас `PeriodPicker`), а не множественный выбор нескольких периодов сразу: разовое правило по
  определению относится к одному периоду. Явно фиксирую это здесь, чтобы не разъезжалось с specs.

## Decisions

**1. Режим выбирается один раз, в начале, и полностью переключает набор полей.**
`SegmentedControl` «Разовая/Регулярная» переносится в самое начало карточки правила (до
`accountingPeriod`/задачи), и `TaskCompletionRuleFields` рендерит один из двух отдельных
подкомпонентов (`OneOffTaskCompletionFields` / `RecurringTaskCompletionFields`) вместо одного общего
дерева с условными кусками. Alternative (отклонено): оставить один компонент с условной видимостью —
это и есть текущее состояние, которое приводит к путанице (переключатель «прячется» между полями
задачи и не читается как первый шаг).

**2. `RuleDraft` не меняется по форме — меняется только то, какие поля из него читает/валидирует активный подкомпонент.**
Плоская структура `RuleDraft` (`taskId`, `accountingPeriod`, `taskTitleTemplate`, …) остаётся общей —
дискриминированный tagged-union на уровне черновика избыточен, т.к. поля и так уже опциональны и не
конфликтуют по именам. `resolveRuleDraft` (`ruleFormSchema.ts`) убирает безусловное требование
`taskId` и требует его только при `isRecurring === false`; `accountingPeriod` остаётся обязательным в
обоих режимах (см. specs: период задаётся явно всегда).

**3. Контракт: `taskCompletionSalaryConfigRequestSchema` → дискриминированный union по `isRecurring`.**
`z.discriminatedUnion('isRecurring', [oneOff, recurring])`, где `oneOff` требует `taskId` и не содержит
полей шаблона, `recurring` требует поля шаблона и не содержит `taskId`. Alternative (отклонено):
`superRefine` на плоской схеме — сохраняет одну плоскую форму, но не даёт полям TS-типа сузиться по
`isRecurring`, из-за чего границу пришлось бы держать вручную в каждом потребителе типа. Discriminated
union даёт то же дерево типов, что и разделение UI/domain-слоя.

**4. Бэкенд: первая задача регулярного правила создаётся через тот же сервис, что и задачи новых периодов.**
`CreateSalaryRuleHandler` (service и shop домены) для `isRecurring: true` после сохранения правила
через `SalaryRuleRepositoryPort.insert()` синхронно вызывает `EnsureRuleTaskForPeriodService.ensure(rule, accountingPeriod, assigneeEmployeeId)`
(и `EnsureShopSalaryTaskForPeriodService.ensure(...)` в shop-домене) — тот же идемпотентный путь,
которым сегодня лениво пользуется формирование зарплатного отчёта; разница только в моменте первого
вызова (сразу при создании правила, а не при первом просмотре отчёта за период). Для `isRecurring: false`
этот вызов не выполняется — `taskId` уже пришёл из payload и кладётся в `taskIdByPeriod`, как сегодня.
Alternative (отклонено): дублировать логику генерации первой задачи из шаблона прямо в
`TaskCompletion.create()` — отклонено, чтобы не разводить два места, вычисляющие дедлайн/название из
шаблона.

**5. Поле суммы начисления (`defaultAmount`) визуально привязывается к шагу «задача» только для разового правила.**
Для регулярного правила сумма относится к правилу в целом (одинакова для всех будущих периодов) и
остаётся отдельным полем формы, как сейчас. Для разового — единственная задача и есть правило, поэтому
поле суммы переносится рядом с task+period-полями, чтобы соответствовать формулировке «начисление за
эту задачу» из proposal. Это чисто UI-перестановка, не меняющая контракт (`defaultAmount` как было
одним полем на верхнем уровне конфигурации, так и остаётся).

## Risks / Trade-offs

- [Discriminated union в контракте меняет форму TS-типа `taskCompletionSalaryConfigRequestSchema`,
  что затронет весь код, деструктурирующий это поле без сужения по `isRecurring`] → найти все места
  через `tsc`/поиск использований на этапе tasks.md, обновить деструктуризацию до сужения по
  дискриминатору.
- [Синхронный вызов `EnsureRuleTaskForPeriodService`/`EnsureShopSalaryTaskForPeriodService` внутри
  `CreateSalaryRuleHandler` увеличивает время ответа и связывает транзакцию создания правила с
  созданием задачи] → сервис уже идемпотентен и сегодня используется в горячем пути формирования
  отчёта; если создание задачи упадёт, откатывать создание самого правила в той же транзакции, чтобы
  не оставлять регулярное правило без задачи первого периода.
- [Старые клиенты, всё ещё присылающие `taskId` при `isRecurring: true`] → discriminated union по
  умолчанию отбрасывает лишние поля (zod strip), так что лишний `taskId` в payload регулярного правила
  просто игнорируется, а не падает с ошибкой валидации.

## Context

`TaskCompletion` — единственный тип зарплатного правила, чья первая задача создаётся не автоматически
по формуле, а руководителем вручную (мастер, шаг 1 — `POST /v1/tasks`, шаг 2 — создание правила,
ссылающегося на уже созданную задачу через `taskId`). Сегодня, к какому расчётному периоду относится
эта первая задача, решает не руководитель, а сервер: `buildTaskCompletionConfig()`
(`backend/src/domains/service/modules/accounting/domain/entities/salary-rules/task-completion.entity.ts`)
жёстко использует `Period.current().getValue()` как ключ в `config.taskIdByPeriod`. То же самое для
регулярного правила на каждый следующий период — `EnsureRuleTaskForPeriodService.ensure()`
(`.../application/services/task-completion/ensure-rule-task-for-period.service.ts`) уже принимает
`period` явным параметром (его вычисляют вызывающие — крон `TaskCompletionAutoCreationCron` и ленивый
путь из `GetEmployeeSalaryReportService`/`GetDepartmentSalaryReportService`), но нигде не записывает
этот `period` в отдельное читаемое поле правила — только как ключ карты `taskIdByPeriod`.

`config` персистируется как есть в JSON-колонке `SalaryRule.props` (`prisma/schema/salary.prisma`), без
собственной Prisma-модели на тип правила; при чтении из БД `props` валидируется той же контрактной
Zod-схемой, что и HTTP-ответ (`taskCompletionSalaryConfigResponseSchema`,
`infrastructure/schemas/salary-rule.schema.ts` → `salaryRuleConfigSchemaByType`) — то есть **любое
новое обязательное поле в response-схеме обязано уметь распарсить уже существующие в БД правила**, у
которых этого поля ещё нет.

Домен `shop` зеркалирует ту же схему независимым набором классов (`domains/shop/modules/accounting`),
но без собственного крона: у `shop` нет аналога `TaskCompletionAutoCreationCron`, единственный
источник автосоздания задачи регулярного правила — ленивый вызов
`EnsureShopSalaryTaskForPeriodService.ensure()` из `GetEmployeeSalaryReportService`/
`GetDepartmentSalaryReportService` домена `shop`.

## Goals / Non-Goals

**Goals:**
- Расчётный период первой задачи правила `TaskCompletion` задаётся руководителем в форме создания
  правила, а не вычисляется сервером неявно.
- Поле `accountingPeriod` доступно и в ответе API (для отображения/повторного редактирования), и
  внутри домена как явный атрибут конфигурации, отдельно от карты `taskIdByPeriod`.
- При автосоздании задачи регулярного правила на новый период (крон `service`, ленивый путь `service`
  и `shop`) `accountingPeriod` правила обновляется на этот новый период — поле всегда отражает период
  самой свежей заведённой задачи.
- Уже существующие в БД правила `TaskCompletion` (созданные до этой фичи, без поля в `props`)
  продолжают читаться без ошибок валидации.

**Non-Goals:**
- Не вводим отдельную Prisma-модель/колонку под период правила — поле остаётся внутри существующего
  JSON `props`.
- Не меняем механику `taskIdByPeriod` (карта период→задача остаётся источником идемпотентности
  `ensure()`) — `accountingPeriod` дублирует её "последний ключ" в явном, удобном для UI виде, не
  заменяет её.
- Не добавляем выбор периода для прочих 6 типов правил (`PayPerHour`, `ServiceCompleted`, `OrderPayed`,
  `DepartmentPercent`, `DepartmentPlanBonus`, `DepartmentTurnoverBonus`) — они не создают собственных
  задач и период не выбирают никогда.
- Не заводим `TaskCompletionAutoCreationCron`-аналог для `shop` — вне скоупа этого изменения;
  `accountingPeriod` в `shop` обновляется только там, где `shop` уже создаёт задачи (ленивый путь).
- Не пишем скрипт бэкофилла БД — обратная совместимость решается на уровне схемы чтения (см. Decisions).

## Decisions

### 1. `accountingPeriod` — обязательное поле запроса, опциональное с деривацией при чтении

`taskCompletionSalaryConfigRequestSchema` (`contracts/commands/salary-rule.ts`) получает новое
**обязательное** поле `accountingPeriod: z.string().regex(PERIOD_REGEX)` (тот же формат `YYYY-MM`, что
у `Period` value object, `backend/src/shared/domain/period.value-object.ts`) — руководитель обязан
осознанно выбрать период при создании/редактировании правила, скрытого дефолта на бэкенде для НОВЫХ
запросов быть не должно (форма сама предзаполняет текущим периодом, см. Decision 4).

`taskCompletionSalaryConfigResponseSchema` (та же схема, что используется и для сериализации HTTP-
ответа, и для парсинга уже персистированного `props` при чтении из БД) получает `accountingPeriod` как
**опциональное** поле (`z.string().regex(PERIOD_REGEX).optional()`), чтобы не ронять парсинг уже
существующих строк `salary_rules`, созданных до этой фичи. `SalaryRuleMapper`
(`infrastructure/repositories/motivation-schema/salary-rule.repository.ts` — маппер `toDomain`)
дерива́т значение, если оно отсутствует: берёт максимальный (по сравнению строк `YYYY-MM`, лексикографически
корректно для этого формата) ключ `taskIdByPeriod`, а если и карта пуста — `Period.current()` как
последний резервный случай. Domain-тип `TaskCompletionSalaryConfig.accountingPeriod` остаётся
`string` (не опциональным) — деривация происходит один раз на границе маппера, дальше в домене и в
API-ответе поле всегда присутствует. Любая последующая мутация конфигурации (`ensure()`, PATCH через
`buildTaskCompletionConfig`) записывает уже дерива́нное/явное значение обратно в `props`, так что поле
"самоисцеляется" при первом касании правила — отдельный бэкофилл-скрипт не нужен (Non-Goal).

Альтернатива (миграция данных, проставляющая `accountingPeriod` всем существующим строкам разовым
SQL/скриптом) отклонена — усложняет деплой (нужен отдельный шаг миграции данных, не только схемы)
ради поля, которое равнозначно восстанавливается из уже имеющихся данных без риска рассинхронизации.

### 2. Domain: `buildTaskCompletionConfig` принимает период явно

`buildTaskCompletionConfig(request, existingTaskIdByPeriod)` перестаёт вызывать `Period.current()` и
использует `request.accountingPeriod` — и как значение `config.accountingPeriod`, и как ключ, под
которым `request.taskId` кладётся в `taskIdByPeriod`. Валидация формата (`Period.create(...)`, бросает
при некорректном значении) остаётся в зоне ответственности домена, а не только Zod-схемы контракта —
согласуется с тем, как `Period` используется во всём проекте (`sales`, `accounting`).

### 3. `EnsureRuleTaskForPeriodService`/`EnsureShopSalaryTaskForPeriodService` обновляют `accountingPeriod`

В обеих реализациях `ensure()`, там же, где сегодня выполняется `config.taskIdByPeriod[period] =
taskId; await this.ruleRepo.update(rule)`, добавляется `config.accountingPeriod = period` — та же
мутация того же объекта `config` перед тем же вызовом `update()`, без нового обращения к репозиторию.
Ранний `return existingTaskId` (идемпотентный путь, когда задача периода уже существует) поле не
трогает — это не создание новой задачи, а значит не "новый текущий период" правила.

### 4. Frontend: `accountingPeriod` в драфте формы, дефолт — текущий период

`RuleDraft` (`frontend/src/features/SalaryRuleForm/model/ruleDraft.ts`) получает новое поле
`accountingPeriod: string` (`YYYY-MM`). `createRuleDraft()`/`resetAwardFields()` инициализируют его
текущим периодом (тот же способ вычисления, что уже использует `PeriodPicker`/`shared/lib/format.ts` —
без похода на бэкенд). Для уже существующего правила (`draftFromRule`/`draftFromShopRule`) значение
берётся из `config.accountingPeriod` ответа API, а не пересчитывается на клиенте — руководитель видит
период, реально записанный в последней задаче правила.

Поле рендерится в `TaskCompletionRuleFields.tsx` компонентом `PeriodPicker`
(`shared/ui-kit/organisms/PeriodPicker.tsx`) рядом с блоком «Задача» — видимо всегда (и для разового, и
для регулярного правила), в отличие от блока «Шаблон для автосоздания…», который показывается только
при `isRecurring`: период относится к САМОЙ первой задаче, которая существует независимо от
периодичности. `service/model/ruleFormSchema.ts`/`shop/model/ruleFormSchema.ts` (резолверы
`RuleDraft` → contract-запрос) добавляют `accountingPeriod: draft.accountingPeriod` в собираемый
`TaskCompletion`-config, с той же обязательностью, что и `taskId` (пустое/невалидное значение —
`errors.accountingPeriod`, по аналогии с существующими `errors.taskId`/`errors.dueDate`).

### 5. PATCH уже существующего правила — `accountingPeriod` редактируемо, но не переоткрывает прошлые периоды

При редактировании уже сохранённого правила (`draft.ruleId` задан) `accountingPeriod` в форме
предзаполнен текущим значением правила и в общем случае руководитель его не трогает — но поле не
делается readonly: если руководитель осознанно меняет его на другой период (например, поправляет
ошибочно указанный при создании), `buildTaskCompletionConfig` просто запишет `taskId` (текущий,
неизменный) под новым ключом `taskIdByPeriod`, не удаляя старые ключи (`existingTaskIdByPeriod`
по-прежнему разворачивается первым). Отдельного запрета/предупреждения не вводим — риск (задача
"переезжает" в другой период отчёта) не выше, чем у прямого редактирования любого другого поля
правила, и не является тем, что эта фича обязана решать (Non-Goal: репликация полноценного визарда
смены периода).

## Risks / Trade-offs

- **[Риск] Неверно введённый период "прошлого" числа** (руководитель по ошибке указывает уже
  наступивший/прошедший период вместо ближайшего) → уже покрыто существующим поведением
  `taskIdByPeriod`/отчётов (строка правила просто не появится в отчёте текущего периода, появится в
  указанном) — то же поведение, что и раньше при скрытом `Period.current()`, просто теперь это выбор
  руководителя, а не случайность момента сохранения формы. Отдельная защита (например, запрет прошлых
  периодов) не вводится — симметрично тому, что `PeriodPicker` уже допускает произвольный выбор в
  других формах проекта.
- **[Риск] Расхождение `accountingPeriod` и фактического максимального ключа `taskIdByPeriod`** при
  прямом редактировании БД в обход приложения → не рассматривается (вне доверенной поверхности
  атаки/эксплуатации приложения).
- **[Trade-off] Опциональность поля в persistence-схеме** усложняет `TaskCompletionSalaryConfig`
  domain-тип на один шаг деривации в мапере вместо простого required-поля — принято ради отказа от
  отдельного шага миграции данных при деплое (см. Decision 1).

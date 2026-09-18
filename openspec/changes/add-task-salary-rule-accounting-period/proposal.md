## Why

Правило «за выполнение задачи» (`TaskCompletion`) сейчас неявно привязывает свою задачу к «текущему»
расчётному периоду: и при создании правила (`buildTaskCompletionConfig`), и при автосоздании задачи на
новый период кроном (`TaskCompletionAutoCreationCron` / `EnsureRuleTaskForPeriodService`) период всегда
вычисляется как `Period.current()` в момент выполнения кода, а не выбирается руководителем осознанно.
Это делает привязку задачи к периоду непрозрачной для руководителя (в форме создания правила поле
периода отсутствует вовсе) и не позволяет создать/поправить задачу правила на период, отличный от
календарного «сейчас» (например, если руководитель создаёт правило в последний день месяца для уже
наступающего следующего периода, либо задним числом для уже прошедшего периода). Нужно сделать
расчётный период явным полем правила: заполняемым руководителем в форме создания и обновляемым кроном
при автосоздании задачи на очередной период для регулярных правил.

## What Changes

- В форму создания/редактирования правила «за выполнение задачи» (`SalaryRuleForm`, домены `service` и
  `shop`) добавляется поле выбора расчётного периода (`PeriodPicker`), по умолчанию — текущий период;
  значение обязательно для правил типа `TaskCompletion`.
- В конфигурацию правила (`TaskCompletionSalaryConfig` / `TaskCompletionShopSalaryConfig`, хранится в
  существующем JSON-поле `SalaryRule.props`, миграция Prisma не требуется) добавляется поле
  `accountingPeriod: string` (формат `YYYY-MM`, тот же, что уже использует `Period`
  value object и ключи `taskIdByPeriod`) — период, к которому относится последняя/текущая задача
  правила.
- При создании правила `accountingPeriod` больше не вычисляется скрыто как `Period.current()`, а
  принимается из запроса (значение, выбранное руководителем в форме) и используется как ключ в
  `taskIdByPeriod` для первой задачи правила.
- Крон автосоздания регулярных задач (`TaskCompletionAutoCreationCron` → `EnsureRuleTaskForPeriodService`,
  и его ленивый аналог, вызываемый из зарплатных отчётов) при создании задачи на новый период для
  регулярного правила обновляет `accountingPeriod` правила на этот новый период — так поле всегда
  отражает период самой свежей заведённой задачи. Аналогично — зеркальный сервис в домене `shop`
  (`EnsureShopSalaryTaskForPeriodService`).
- **BREAKING**: контракт `taskCompletionSalaryConfigRequestSchema` (и shop-аналог) получает новое
  обязательное поле `accountingPeriod` — существующие клиенты, создающие правило без этого поля,
  должны быть обновлены.

## Capabilities

### New Capabilities

(нет)

### Modified Capabilities

- `service/accounting`: требование «Разовое и регулярное правило «за выполнение задачи»» дополняется —
  расчётный период правила при создании SHALL задаваться явно, а не вычисляться неявно как текущий; при
  автосоздании задачи регулярного правила на новый период крон SHALL обновлять это поле.
- `shop/accounting`: то же требование, зеркально, для направления `shop`.

## Impact

- **Contracts**: `contracts/commands/salary-rule.ts` и `contracts/commands/shop-salary-rule.ts` —
  новое поле `accountingPeriod` в request/response схемах `TaskCompletion`-конфига.
- **Backend (service)**: `domain/types/salary-rule.types.ts`,
  `domain/entities/salary-rules/task-completion.entity.ts` (`buildTaskCompletionConfig`),
  `application/services/task-completion/ensure-rule-task-for-period.service.ts`,
  `infrastructure/cron/task-completion-auto-creation.cron.ts`.
- **Backend (shop)**: зеркальные файлы в `domains/shop/modules/accounting`.
- **Frontend**: `features/SalaryRuleForm` (`model/ruleDraft.ts`, `ui/RuleFormCard/ui/TaskCompletionRuleFields.tsx`,
  service/shop `model/ruleFormSchema.ts`), использует существующий `shared/ui-kit/organisms/PeriodPicker`.
- Prisma-миграция не требуется — поле хранится в существующей JSON-колонке `SalaryRule.props`.

## Why

Дедлайн задачи, автосоздаваемой регулярным зарплатным правилом «за выполнение задачи», сейчас
всегда попадает внутрь расчётного периода, к которому относится задача: `deadlineTemplate` —
ISO-дата, из которой для регулярной задачи используется только число месяца, а год/месяц берутся
из целевого периода (`computeRecurringTaskDeadline`/`computeDeadlineForPeriod`, зеркальные функции
в `domains/shop` и `domains/service`). На практике дедлайн часто нужно ставить за пределами
периода — например, задача относится к январю, но фактически должна быть закрыта до 5 февраля
(отчётность/сверка после закрытия месяца). Сейчас так указать нельзя: поле в форме — обычный
`<input type="date">», и даже если ввести дату в другом месяце, бэкенд всё равно возьмёт только
число дня и подставит его в месяц/год периода.

## What Changes

- Меняется формат `deadlineTemplate`: вместо буквальной ISO-даты, из которой для регулярного
  правила используется только число месяца, шаблон явно задаёт **число месяца дедлайна** и
  **смещение относительно периода задачи** (0 — тот же месяц, что и период; 1 — следующий месяц
  после периода и т. д.). **BREAKING**: меняется формат персистентного поля
  `TaskCompletion{Service,Shop}SalaryConfig.deadlineTemplate` — потребуется миграция существующих
  значений (интерпретировать текущие как смещение 0).
- `computeRecurringTaskDeadline` (`domains/shop`) и `computeDeadlineForPeriod` (`domains/service`)
  получают учёт смещения периода при вычислении года/месяца дедлайна (день по-прежнему зажимается
  длиной итогового месяца).
- Поле «Дедлайн шаблона» в форме регулярного правила (`TaskCompletionRuleFields.tsx`) заменяется на
  пару контролов: число месяца + смещение периода («в этом месяце» / «в следующем месяце» и т. п.),
  вместо `<input type="date">`.
- Разовое правило (`isRecurring: false`) не затрагивается — там `deadlineTemplate` по-прежнему
  используется буквально как дата.

## Capabilities

### New Capabilities

(нет — расширяется существующая возможность, отдельная capability не заводится)

### Modified Capabilities

- `service/accounting`: правило «за выполнение задачи» — формат и вычисление дедлайна регулярной
  задачи допускает смещение в следующий(-е) период(-ы).
- `shop/accounting`: то же самое для направления `shop`.

## Impact

- Backend, `domains/service/modules/accounting`: `domain/services/task-deadline.ts` (или его аналог
  внутри `ensure-rule-task-for-period.service.ts`, где живёт `computeDeadlineForPeriod`),
  `domain/types/salary-rule.types.ts` (`TaskCompletionServiceSalaryConfig.deadlineTemplate`).
- Backend, `domains/shop/modules/accounting`: `domain/services/task-deadline.ts`
  (`computeRecurringTaskDeadline`), `domain/types/salary-rule.types.ts`
  (`TaskCompletionShopSalaryConfig.deadlineTemplate`).
- `contracts`: схемы правила в `commands/salary-rule.ts` и `commands/shop-salary-rule.ts`
  (поле `deadlineTemplate`).
- Frontend: `features/SalaryRuleForm/ui/RuleFormCard/ui/TaskCompletionRuleFields.tsx` и модель формы
  (`features/SalaryRuleForm/model/ruleDraft.ts`, `ruleFormSchema.ts` для `service`/`shop`).
- Миграция существующих данных: строки `SalaryRule` с `isRecurring: true` и уже сохранённым
  `deadlineTemplate` нужно привести к новому формату (смещение 0) без ручного вмешательства.

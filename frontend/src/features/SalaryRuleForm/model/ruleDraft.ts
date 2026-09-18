import type { TargetRole } from 'ireports-contracts'

import type { ServiceRuleType, ShopRuleType } from '@/kernel/ruleTypeLabels.ts'

/**
 * `ServiceRuleType`/`ShopRuleType` moved to `kernel/ruleTypeLabels.ts` (needed by
 * `pages/SalaryRuleList` too, which can't import another page) — re-exported here so this file's
 * existing consumers keep working unchanged.
 */
export type { ServiceRuleType, ShopRuleType }

// '2026-08' — текущий месяц в формате `YYYY-MM`, который ожидает бэкенд (`Period.create`,
// `backend/src/shared/domain/period.value-object.ts`). Тот же приём, что и `getCurrentPeriod()` в
// `pages/GoodsTurnoverReport/model/useGoodsTurnoverReportPage.ts` — не общий хелпер, каждая фича с
// полем периода строит его сама из `Date` (см. комментарий там же).
function getCurrentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * One flat draft (below) is reused for both directions' rule cards, so this is the union of both —
 * NOT a merged/mixed contract type (that stays strictly separate, see `service/model/ruleFormSchema.ts`
 * vs `shop/model/ruleFormSchema.ts`): purely the set of string values `draft.type` can hold while being
 * edited. Which subset is actually offered/valid for the currently selected direction is decided by
 * `RuleFormConfig.ruleTypeOrder` (`service/model/ruleTypes.ts`/`shop/model/ruleTypes.ts`), not by this type.
 */
export type RuleType = ServiceRuleType | ShopRuleType

/** The 3 department-level rule types from add-department-head-salary-rules (FR2-FR4) — common to
 * both directions (same literal type names, `kernel/ruleTypeLabels.ts`). Unlike every other
 * `RuleType`, none of these 3 offers an award-variant selector at all (ui-design.md
 * «Отклонения»): `core/ui/RuleFormCard`'s `RuleFormCard.tsx` reads this list to skip rendering
 * `AwardSection` for them — their own fixed field set is rendered entirely by
 * `RuleFormCardFields.tsx` instead (Implements FR2, FR3, FR4). */
export const DEPARTMENT_RULE_TYPES: RuleType[] = ['DepartmentPercent', 'DepartmentPlanBonus', 'DepartmentTurnoverBonus']

/** Union of every `award.type` across the 3 award-bearing rule types — which subset applies to a
 * given `RuleType` is `service/model/ruleTypes.ts`'s `AWARD_OPTIONS_BY_TYPE`. `FloatPercentMarginFloor`
 * — shop `ProductSold`-only ("Продажа товара Б/У", `shop/model/ruleTypes.ts`'s `SHOP_AWARD_OPTIONS_BY_TYPE`),
 * see `productSoldSalaryConfigSchema.award` (`contracts/commands/shop-salary-rule.ts`). */
export type AwardKind =
    'Fixed' | 'ServiceFixed' | 'ServicePercent' | 'FixedPercent' | 'FloatPercent' | 'FloatPercentMarginFloor'

export type BorderMode = 'FIX' | 'LINEAR'

export type SalaryBasisValue = 'REVENUE' | 'MARGIN' | 'SALARY_MINUS_ENGINEER_SALARY'

/** One row of `percentBorders` while being edited — numeric fields stay strings (same "text input,
 * parse on submit" convention as Фаза 2's `rate`, see `SalaryRulesRuleCard.tsx`) so the input can
 * hold transient states like `""`/`"1,"` while typing. */
export type BorderDraft = {
    name: string
    fromPlanPercent: string
    multiplier: string
    mode: BorderMode
}

/**
 * Flat draft for one rule card. Reused as-is across all `RuleType`s (fields irrelevant to the
 * current `type`/`awardKind` are simply unread) rather than separate draft shapes — mirrors
 * `frontend/CLAUDE.md`'s "model-хуки с плоским объектом состояния" spirit: one shape, one set of
 * change handlers, the *rendered* form (`core/ui/RuleFormCard`) is what varies by type.
 *
 * `percentBorders` is a plain array (not a fixed 3-tuple) on purpose, even though the UI never
 * offers add/remove controls for it (`ThresholdsEditor` always renders exactly 3 rows) — this
 * keeps the "exactly 3 borders" rule a real runtime check in `service/model/ruleFormSchema.ts`
 * (`resolveRuleDraft`) instead of something only TypeScript enforces, which is what makes it a
 * meaningful case for the unit test the phase asks for.
 */
export type RuleDraft = {
    draftId: string
    /** id of the persisted rule this draft was loaded from (`draftFromRule`/`draftFromShopRule`),
     * `undefined` for a draft created via "Добавить правило" (brand-new rule). Threaded through to
     * `resolveRuleDraft`/`resolveShopRuleDraft`'s output as `id` on PATCH, so the backend can tell
     * "this rule was edited in place" from "this rule is new" (see `salaryRuleRequestSchema`'s `id`
     * comment, `contracts/commands/salary-rule.ts`) — without it every PATCH replaced the whole rule
     * set with brand-new ids, which silently deleted and recreated the Bitrix24 task behind every
     * `TaskCompletion` rule on every edit, even when nothing about that rule changed. */
    ruleId?: string
    /** Whether this draft was ever accepted via "Сохранить правило" — decides what "Отмена"/
     * collapsing does (see `useSalaryRulesDraft.ts`): a draft added via "Добавить правило" and
     * never confirmed is discarded on cancel/collapse; a confirmed one just collapses. */
    confirmed: boolean
    type: RuleType
    name: string
    targetRole: TargetRole | ''
    /** `PayPerHour.config.price`, award `Fixed.price`, `TaskCompletion.config.defaultAmount` and
     * `DepartmentPlanBonus`/`DepartmentTurnoverBonus`'s `config.fixedAmount` (add-department-head-
     * salary-rules, FR3/FR4) share this field (only one is ever read, depending on `type`/
     * `awardKind`) — same "money as text, parsed on submit" shape for all of them. */
    price: string
    awardKind: AwardKind | ''
    /** `ServicePercent.percent` / `FixedPercent.percent` / `DepartmentPercent.config.percent`
     * (add-department-head-salary-rules, FR2). */
    percent: string
    /** `FloatPercent.basePercent` (`OrderPayed`/`ProductSold` only). */
    basePercent: string
    salaryBasis: SalaryBasisValue | ''
    percentBorders: BorderDraft[]
    thresholdsExpanded: boolean
    /** `ProductSold.config.category` / `UsedProductSold.config.category` (Фаза 4, shop only) — id of
     * a `MoySkladProductFolder` node, or `null` for "все категории". Contract-required (nullable,
     * never absent — see `contracts/commands/shop-salary-rule.ts`), so the draft always carries a
     * value; `null` is the deliberate default (see `createRuleDraft`), not an unset/error state. Read
     * only for `ProductSold`/`UsedProductSold`; ignored otherwise. */
    category: string | null
    /** `DepartmentPercent.config.departmentId` / `DepartmentPlanBonus.config.departmentId` (service
     * only, временный костыль поверх design.md Decision 1 из add-department-head-salary-rules) —
     * явное переопределение отдела, чей план продаж используется вместо собственного отдела
     * сотрудника (для случая, когда у него ещё нет плана). `''` — «свой отдел» (переопределения
     * нет, поведение по умолчанию), как и `warehouseId`/`taskId` для своих полей — единственное
     * отличие в том, что здесь `''` валиден (поле опционально, в отличие от обязательного
     * `warehouseId`). Read only for `DepartmentPercent`/`DepartmentPlanBonus`; ignored otherwise. */
    departmentIdOverride: string
    /** `OrderPayed.config.orderTypeIds` / `ServiceCompleted.config.orderTypeIds` (Фаза 5,
     * docs/service-plan-salary-rule-order-category-filter, service only) — id'ы `RoappOrderType`
     * (`RoappOrder.orderTypeId`), НЕ `SalesPlan.category`/`RoappServiceCategory`/`RoappProductCategory`.
     * `[]` — «учитывать заказы всех типов», как и на бэкенде для отсутствующего/пустого поля (см.
     * `orderPayedSalaryConfigSchema`/`serviceCompletedSalaryConfigSchema` в `contracts/commands/salary-rule.ts`),
     * поэтому черновик всегда несёт значение (never `undefined`), а не отдельное "не задано" состояние.
     * Read only for `OrderPayed`/`ServiceCompleted`; ignored otherwise. */
    orderTypeIds: number[]
    /**
     * split-task-completion-rule-form — id уже существующей задачи ЭТОГО правила. Больше не
     * заполняется отдельной панелью создания задачи (см. `taskTitle`/`taskDeadline` ниже) — для
     * НОВОГО разового правила (`taskId === ''`) задача создаётся тем же запросом, что и само
     * правило, из буквальных полей ниже; `taskId` в этом состоянии остаётся `''` вплоть до
     * успешного сохранения схемы (сервер сам создаёт задачу и возвращает её id только в составе
     * `taskIdByPeriod` последующего `GET`). Для уже существующего (персистентного) правила — id
     * задачи текущего периода из `config.taskIdByPeriod` (см. `draftFromRule`'s комментарий) —
     * `TaskCompletionRuleFields.tsx` в этом состоянии показывает readonly-виджет уже созданной
     * задачи (клик открывает её карточку), а не поля ниже.
     */
    taskId: string
    /** `TaskCompletionSalaryConfigRequest`'s `taskTitle` (разовое правило, split-task-completion-rule-form)
     * — буквальное название ЕДИНСТВЕННОЙ задачи правила, вводится прямо в этой форме (а не в
     * отдельной панели создания задачи, как было раньше) и создаётся тем же запросом, что и само
     * правило. Read only when `type === 'TaskCompletion' && !isRecurring && taskId === ''`
     * (`TaskCompletionRuleFields.tsx`); ignored otherwise. */
    taskTitle: string
    /** `TaskCompletionSalaryConfigRequest`'s `taskDescription` — необязательное буквальное описание
     * той же единственной задачи разового правила. Тот же read-only-scope, что и `taskTitle`. */
    taskDescription: string
    /** `TaskCompletionSalaryConfigRequest`'s `taskDeadline` (ISO-дата `YYYY-MM-DD`) — буквальный,
     * настоящий календарный дедлайн единственной задачи разового правила (в отличие от
     * `deadlineTemplate` ниже, который для регулярного правила несёт только число месяца). Тот же
     * read-only-scope, что и `taskTitle`. */
    taskDeadline: string
    /** `TaskCompletionSalaryConfigRequest`'s `taskLinks` (разовое правило) — ссылки, прикрепляемые к
     * единственной задаче при её создании тем же запросом, что и правило. Отдельное поле от
     * `taskLinkTemplates` ниже (тот — только для регулярного правила, шаблон на каждый период). Тот
     * же read-only-scope, что и `taskTitle`. */
    taskLinks: { url: string; label?: string }[]
    /** `TaskCompletion.config.accountingPeriod` (`YYYY-MM`, add-task-salary-rule-accounting-period)
     * — расчётный период, к которому относится последняя/текущая задача правила; руководитель
     * выбирает его явно в форме (`PeriodPicker`, `TaskCompletionRuleFields.tsx`), больше не
     * вычисляется неявно на бэкенде. `createRuleDraft`/`resetAwardFields` предзаполняют текущим
     * периодом (`getCurrentPeriod()` выше); для уже сохранённого правила (`draftFromRule`/
     * `draftFromShopRule`) значение берётся из ответа API (`config.accountingPeriod`), а не
     * пересчитывается на клиенте (design.md, Decision 4) — руководитель видит период, реально
     * записанный в последней задаче правила. Read only for `TaskCompletion`; ignored otherwise. */
    accountingPeriod: string
    /** `TaskCompletion.config.taskTitleTemplate` — шаблон заголовка задачи для авто-пересоздания
     * РЕГУЛЯРНОГО правила на новый период (`EnsureRuleTaskForPeriodService`), НЕ заголовок самой
     * первой задачи (тот уже произвольно введён на Шаге 1 мастера, см. `taskId`'s комментарий).
     * Контракт требует непустую строку структурно (`z.string()`), но поле осмысленно только при
     * `isRecurring === true` — `TaskCompletionRuleFields.tsx` показывает его лишь тогда, и только
     * тогда `resolveRuleDraft` требует его непустым. Read only for `TaskCompletion`; ignored
     * otherwise. */
    taskTitleTemplate: string
    /** `TaskCompletion.config.taskDescriptionTemplate` — необязательный шаблон описания для того
     * же авто-пересоздания (см. `taskTitleTemplate`'s комментарий); `''` — «не задано»
     * (сериализуется как `undefined` в `resolveRuleDraft`, не как пустая строка). Read only for
     * `TaskCompletion`; ignored otherwise. */
    taskDescriptionTemplate: string
    /** `TaskCompletion.config.isRecurring` (node `wQOPI`, «Периодичность»: Разовая/Регулярная) — есть
     * ли смысл заново создавать задачу на каждый расчётный период, или она разовая (заведена один
     * раз, никогда не пересоздаётся). Read only for `TaskCompletion`; ignored otherwise. */
    isRecurring: boolean
    /** `TaskCompletion.config.deadlineTemplate` — то же самое разделение, что и у
     * `taskTitleTemplate`: шаблон дедлайна для авто-пересоздания РЕГУЛЯРНОГО правила (только число
     * месяца читается бэкендом), а не дедлайн самой первой задачи (тот введён на Шаге 1 мастера
     * отдельным полем `CreateTaskForm`). Для регулярного правила (`isRecurring === true`) хранит
     * НЕ настоящую дату, а голые непадженные цифры дня в конце строки (`"2000-01-3"` →
     * `"2000-01-31"` по мере набора, см. `TaskCompletionRuleFields.tsx`'s `buildDeadlineDayTemplate`)
     * — `padStart`/зажатие 1..31 делает `normalizeDeadlineDayTemplate`
     * (`model/formNumberUtils.ts`) один раз на границе, в `resolveRuleDraft`/`resolveShopRuleDraft`,
     * а не здесь. Для разового правила — как есть, буквальная дата, без этой нормализации.
     * Read only for `TaskCompletion`; ignored otherwise. */
    deadlineTemplate: string
    /** `TaskCompletion.config.deadlinePeriodOffset` (recurring-task-deadline-offset, FR1) — на
     * сколько расчётных периодов вперёд от периода авто-пересозданной задачи отсчитывается её
     * дедлайн: `0` — дедлайн в месяце периода задачи (поведение по умолчанию, обратная
     * совместимость с уже персистированными правилами), `1..3` — на 1..3 месяца вперёд. Хранится
     * как обычное число (не VO — `DeadlinePeriodOffset` конструируется транзитно только на бэкенде
     * для валидации инварианта, см. architecture.md поправку), число месяца по-прежнему берётся из
     * `deadlineTemplate` выше. Read only for `TaskCompletion` with `isRecurring === true`
     * (`TaskCompletionRuleFields.tsx` показывает контрол только тогда); ignored otherwise — тот же
     * приём, что и у `taskTitleTemplate`. */
    deadlinePeriodOffset: number
    /** `TaskCompletion.config.taskLinkTemplates` — ссылки, прикрепляемые к каждой АВТОСОЗДАННОЙ
     * задаче регулярного правила (`EnsureRuleTaskForPeriodService`), не к самой первой (та уже
     * создана вручную, со своими произвольными ссылками, на Шаге 1). Read only for `TaskCompletion`
     * with `isRecurring === true`; ignored otherwise, add-task-rule-task-lifecycle. */
    taskLinkTemplates: { url: string; label?: string }[]
    /** `TaskCompletionSalaryConfigRequest`'s `createTaskForCurrentPeriod` (регулярное правило,
     * split-task-completion-rule-form) — чекбокс «Создать задачу в текущем периоде»: снят —
     * регулярное правило создаётся без задачи вовсе, первая появится позже лениво, при наступлении
     * следующего периода (`EnsureRuleTaskForPeriodService`). По умолчанию включён (то же поведение,
     * что действовало раньше неявно). Read only for `TaskCompletion` with `isRecurring === true` и
     * только при создании НОВОГО правила (`ruleId === undefined`) — при редактировании уже
     * существующего регулярного правила задача текущего периода либо уже есть, либо нет, эта форма
     * её больше не пересоздаёт, см. `TaskCompletionRuleFields.tsx`. */
    createTaskForCurrentPeriod: boolean
    /** `DepartmentTurnoverBonus.config.warehouseId` (add-department-head-salary-rules, FR4) — id
     * склада, обязательное поле (design.md Decision 2: оборачиваемость скоуплена по категории ×
     * складу, автоматической привязки сотрудник→склад нет). Текстом, как и остальные числовые/id
     * поля драфта — `service/model/ruleFormSchema.ts` парсит его как `number` (RoApp warehouse id),
     * `shop/model/ruleFormSchema.ts` оставляет как есть (MoySklad UUID), см.
     * `ruleAwards.ts`'s `buildDepartmentTurnoverBonusConfig`'s `warehouseIdKind` param. `''` —
     * «склад не выбран», единственное состояние, в котором резолвер отказывает. Read only for
     * `DepartmentTurnoverBonus`; ignored otherwise. */
    warehouseId: string
    /** `DepartmentTurnoverBonus.config.planTurnoverRatio` (FR4) — план коэффициента оборачиваемости,
     * хранится прямо в конфигурации правила, а не как отдельная сущность (design.md Decision 2).
     * Текст, парсится на сабмите как и остальные числовые поля драфта. Read only for
     * `DepartmentTurnoverBonus`; ignored otherwise. */
    planTurnoverRatio: string
    /** `FloatPercentMarginFloor.marginThreshold` ("Продажа товара Б/У", shop `ProductSold`-only) —
     * порог по марже КОНКРЕТНОЙ проданной позиции: при profit >= порога считается по FloatPercent
     * (basePercent/percentBorders выше), иначе — `lowMarginPercent` ниже. Read only for `ProductSold`
     * with `awardKind === 'FloatPercentMarginFloor'`; ignored otherwise. */
    marginThreshold: string
    /** `FloatPercentMarginFloor.floorAmount` — минимальная сумма начисления за позицию, когда её
     * маржа >= `marginThreshold`, но посчитанная по FloatPercent сумма меньше этого порога. Read
     * only for `ProductSold` with `awardKind === 'FloatPercentMarginFloor'`; ignored otherwise. */
    floorAmount: string
    /** `FloatPercentMarginFloor.lowMarginPercent` — процент от цены продажи позиции (REVENUE),
     * которым заменяется базовая формула FloatPercent, когда маржа позиции ниже `marginThreshold`.
     * Read only for `ProductSold` with `awardKind === 'FloatPercentMarginFloor'`; ignored
     * otherwise. */
    lowMarginPercent: string
}

/** Default 3 threshold rows — pre-filled with the mockup's own example values (`design/
 * sallary-first-iteration.pen`, node `l0o4nP`) as a sensible starting template a user overwrites,
 * rather than empty rows for a field with no natural zero-default. */
export function defaultBorders(): BorderDraft[] {
    return [
        { name: 'Ниже плана', fromPlanPercent: '0', multiplier: '0.5', mode: 'FIX' },
        { name: 'Выполнение плана', fromPlanPercent: '70', multiplier: '1', mode: 'LINEAR' },
        { name: 'Перевыполнение', fromPlanPercent: '120', multiplier: '1.2', mode: 'FIX' },
    ]
}

export function createRuleDraft(type: RuleType = 'PayPerHour'): RuleDraft {
    return {
        draftId: crypto.randomUUID(),
        confirmed: false,
        type,
        name: '',
        targetRole: '',
        price: '',
        awardKind: '',
        percent: '',
        basePercent: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
        departmentIdOverride: '',
        orderTypeIds: [],
        taskId: '',
        taskTitle: '',
        taskDescription: '',
        taskDeadline: '',
        taskLinks: [],
        accountingPeriod: getCurrentPeriod(),
        taskTitleTemplate: '',
        taskDescriptionTemplate: '',
        isRecurring: false,
        deadlineTemplate: '',
        deadlinePeriodOffset: 0,
        taskLinkTemplates: [],
        createTaskForCurrentPeriod: true,
        warehouseId: '',
        planTurnoverRatio: '',
        marginThreshold: '',
        floorAmount: '',
        lowMarginPercent: '',
    }
}

/** Switching "Тип правила" clears every award-specific field (the previous type's `awardKind`/
 * price/percent/etc. have no meaning under the new type) but keeps `name` — the role is reset by
 * the caller only if it falls outside the new type's `allowedRoles` (`core/ui/RuleFormCard`),
 * not unconditionally here, since `resetAwardFields` doesn't know the allowed-roles list. */
export function resetAwardFields(draft: RuleDraft, nextType: RuleType): RuleDraft {
    return {
        ...draft,
        type: nextType,
        awardKind: '',
        price: '',
        percent: '',
        basePercent: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
        departmentIdOverride: '',
        orderTypeIds: [],
        taskId: '',
        taskTitle: '',
        taskDescription: '',
        taskDeadline: '',
        taskLinks: [],
        accountingPeriod: getCurrentPeriod(),
        taskTitleTemplate: '',
        taskDescriptionTemplate: '',
        isRecurring: false,
        deadlineTemplate: '',
        deadlinePeriodOffset: 0,
        taskLinkTemplates: [],
        createTaskForCurrentPeriod: true,
        warehouseId: '',
        planTurnoverRatio: '',
        marginThreshold: '',
        floorAmount: '',
        lowMarginPercent: '',
    }
}

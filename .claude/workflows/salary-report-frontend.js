export const meta = {
  name: 'salary-report-frontend',
  description: 'Переверстать pages/SalaryReportV2 (только сотрудник) на бенто-карточки + боковые панели детализации по новому дизайну Pencil (design/sallary-first-iteration.pen, "Вариант C")',
  phases: [
    { title: 'Foundation', detail: 'группировка правил, две боковые панели (правило/роль, план продаж)' },
    { title: 'UI', detail: 'параллельно: карточки "Итого"+"Задачи" и карточки направлений' },
    { title: 'Integrate', detail: 'сборка EmployeeReportBodyV2, чистка мёртвого кода, lint/build, проверка в браузере' },
    { title: 'Review', detail: 'ревью по конвенциям frontend/CLAUDE.md и по требованию пользователя не выдумывать данные' },
  ],
}

const ROOT = '/Users/artemmurygin/Desktop/iReapir/iReports/iReports'
const PEN = ROOT + '/design/sallary-first-iteration.pen'

const CONTEXT = `
ПРОЕКТ: монорепо iReports, фронтенд в ${ROOT}/frontend (React 19 + Vite + TS, TanStack Query, React Router, Tailwind v4, FSD). ОБЯЗАТЕЛЬНО прочитай ${ROOT}/frontend/CLAUDE.md целиком (конвенции: model/api.ts с queryOptions-фабриками, mediator/страница без &&/тернарников, слоты вместо children, только "import type" из 'ireports-contracts', границы FSD через eslint-plugin-boundaries, UI Kit в shared/ui-kit — НЕ добавлять новые компоненты в shared/ui/).

ВАЖНО — НЕ ДОВЕРЯЙ никаким старым планам/заметкам про "pages/SalaryReport": такой страницы больше не существует, её заменил "pages/SalaryReportV2" (роут /salaries и /salaries/employee/:employeeId, оба -> SalaryReportV2Page, уже в навигации). Твоя задача — ПРАВИТЬ СУЩЕСТВУЮЩИЙ pages/SalaryReportV2, а не создавать параллельную страницу.

СКОУП ЭТОГО ЗАХОДА (подтверждено пользователем в диалоге):
1. Меняется ТОЛЬКО тело отчёта СОТРУДНИКА — ${ROOT}/frontend/src/pages/SalaryReportV2/ui/EmployeeReportBodyV2.tsx и его новые подкомпоненты. Тело отчёта ОТДЕЛА (DepartmentReportBodyV2.tsx и всё, что начинается на "Department*"/"DepartmentLedger*") — НЕ ТРОГАТЬ и не переверстывать.
2. Раньше в этом заходе уже пытались добавить панель "Детализация задачи" с полями Статус/Срок/Ответственный/История начислений — пользователь явно запретил это: "Данные должны отображаться ровно те, что есть в нашей карточке" (никаких выдуманных полей, которых нет в контракте отчёта). Макет — только визуальная основа, не источник полей.
3. Пользователь также указал: "У одной роли может быть много зарплатных правил... я допустил ошибку при формировании дизайна и не заложил группировку по зарплатным правилам внутри роли. Реализуй это самостоятельно" — панель детализации роли ОБЯЗАНА группировать начисления по правилам (rule), а не показывать один плоский список заказов на всю роль.
4. Пользователь подтвердил: похожая боковая панель уже реализована в проекте — переиспользуй ${ROOT}/frontend/src/shared/ui-kit/organisms/SidePanel.tsx (Dialog поверх radix-ui: правая панель 460px на десктопе, bottom sheet на мобильном, уже используется как ${ROOT}/frontend/src/features/SalaryRuleDetailsPanel/ui/SalaryRuleDetailsPanel.tsx и ${ROOT}/frontend/src/features/TaskStatusControl/ui/TaskDetailsPanel.tsx — НЕ ИЗОБРЕТАЙ свой drawer/modal с нуля).

ТЕКУЩАЯ АРХИТЕКТУРА (проверено чтением файлов, не гадай заново):
- Данные: ${ROOT}/frontend/src/features/SalaryReportData/model/ — api.ts (queryOptions), types.ts (SalaryDirection, DirectionReportVM { direction, label, isClosed, total, rules: SalaryReportRule[], salesPerformance: SalesPerformanceSummary[], isPlanApproved, accrualStatus }, EmployeeReportVM { period, directions: DirectionReportVM[], grandTotal, isClosed }, isFloatPercentRule(rule), getRulePercents(rule), sumFactPrognose/sumAllFactPrognose), useEmployeeSalaryReport.ts, labels.ts (SALARY_DIRECTION_LABELS, getRoleLabel(role), возможно RULE_TYPE_LABELS — проверь), formatFloatPercentRange.ts, pluralizeEmployees.ts.
- SalaryReportRule = { ruleId, type, name, targetRole, amount: {fact, prognose|null}, appliedPercent?, floatPercent?: {fact,prognose}, sources: EmployeeSalaryReportSource[] } (contracts/commands/salary-rule.ts, employeeSalaryReportRuleSchema). type — дискриминант: 'TaskCompletion' — правило за выполнение Bitrix-задачи (сотрудник получает фикс за каждую закрытую задачу вида "Обучение новичка"/"Инвентаризация" и т.п.), остальные типы (PayPerHour/ServiceCompleted/OrderPayed/DepartmentPercent/...) — обычные ролевые правила. targetRole — роль сотрудника, за которую платит правило.
- Источник (sources[]) = { type, id, label?, link?, amount?: {fact, prognose|null}, brand?, deviceModel?, deviceColor?, malfunction?, itemName? } — НИКАКИХ полей статуса/срока/ответственного/истории тут нет и не будет.
- Текущая раскладка ${ROOT}/frontend/src/pages/SalaryReportV2/ui/EmployeeReportBodyV2.tsx: grid xl:grid-cols-[minmax(0,1fr)_404px] — слева <LedgerCard report .../> (гроссбух: LedgerHero (герой "Начислено всего · факт"/"Прогноз" + DeltaBadge, см. ui/LedgerHero.tsx + model/deltaTone.ts) -> LedgerDirectionBlock на каждое направление -> LedgerRoleGroup (группировка по groupRulesByRole, аккордеон роли, видна сумма роли) -> LedgerRuleRow (строка правила, аккордеон, видна rule.amount) -> RuleSourcesRail (плоский список source, "показать 3 / ещё N")), справа — колонка <SalesPlanCardV2 .../> по каждому направлению с salesPerformance.length>0.
- ЭТИ ФАЙЛЫ ПОЛНОСТЬЮ ПЕРЕИСПОЛЬЗУЕМЫ (не копировать логику руками, импортировать напрямую): ui/LedgerRuleRow.tsx (самодостаточная строка правила с аккордеоном -> RuleSourcesRail), ui/RuleSourcesRail.tsx (список source), ui/LedgerHero.tsx + ui/DeltaBadge.tsx + model/deltaTone.ts (герой "Итого"), model/groupRulesByRole.ts (группировка по roleRow).

НОВЫЙ ДИЗАЙН (Pencil, файл ${PEN}, зашифрован — читать ТОЛЬКО через mcp__pencil__* — загрузи одним ToolSearch "select:mcp__pencil__get_app_state,mcp__pencil__execute"; execute: Get(id,(n,ctx)=>{Print(...);if(ctx.depth>N)ctx.skipChildren()}) — БЕЗ top-level return, Print вместо console, ограничивай depth иначе ответ обрежется по лимиту токенов). Узел "Вариант C · Бенто-источники" (id YCxrT, десктоп 1440) и "Вариант C · Моб. · Бенто-источники" (id L2Ztk, 390) заменяют текущую LedgerCard+SalesPlanCardV2 раскладку на карточки-бенто:
- ДЕСКТОП: слева "Колонка · Зарплата" (448px): карточка "Итого" (=переиспользуй LedgerHero как есть, просто оберни в карточку shared/ui-kit-стиля rounded-xl border-hairline bg-surface) + карточка "Источник · Задачи" (правила с type==='TaskCompletion' из ОБОИХ направлений сразу, объединённые в один список — шапка "Задачи · N правил · M задач", сумма fact/prognose по этим правилам, затем по одной НЕ-раскрывающейся строке на правило: название, узкий прогресс-трек = clamp(fact/prognose*100, 0, 100) если prognose>0 иначе 100, факт, прогноз, шеврон — клик открывает панель детализации с rules=[этоПравило]). Справа "Источники" (~912px, на practике — оставшаяся ширина): по карточке на направление (только если у направления есть хоть одно НЕ-TaskCompletion правило) — шапка (точка направления, direction.label, мета "N ролей · M правил" — считать по groupRulesByRole без TaskCompletion-правил), сумма fact/prognose (по ролевым правилам направления, БЕЗ TaskCompletion — те уже в карточке "Задачи"), затем одна строка на РОЛЬ (groupRulesByRole, НЕ на правило): getRoleLabel(role), прогресс-трек = clamp(суммаFact/суммаPrognose*100), сумма факт/прогноз по всем правилам роли, шеврон — клик открывает панель детализации с rules=группа.rules, title=getRoleLabel(role) (роль может содержать много правил — панель ОБЯЗАНА показать их все по отдельности, см. ниже). Под строками ролей — мини-тизер плана продаж направления (если salesPerformance.length>0): "ПЛАН ПРОДАЖ · {label}" + бейдж "Утверждён"/"Не утверждён" (isPlanApproved) + ссылка "Подробнее" -> открывает панель плана продаж. Для мини-превью категорий НЕ рисуй новый donut/pie-чарт с нуля (это не то, ради чего затевается редизайн) — достаточно компактной сводки (например "%N выполнения · M категорий"), если существующего готового radial/donut-компонента в shared/ui-kit нет — проверь сам, не изобретай тяжёлую визуализацию.
- МОБАЙЛ (L2Ztk): те же 4 карточки, но ОДНИМ вертикальным стеком в ДРУГОМ порядке — Итого -> Источник·Сервис -> Источник·Магазин -> Источник·Задачи (задачи внизу, а не рядом с Итого, как на десктопе!). Реализуй порядок через раздельные блоки under md:hidden / hidden md:block (как и раньше делала страница) либо через order-* утилиты — выбери то, что проще читается, но порядок должен совпадать.
- Прочитай сами узлы YCxrT/L2Ztk через execute перед вёрсткой, чтобы сверить точные отступы/размеры (не только текст выше).

ПАНЕЛЬ ДЕТАЛИЗАЦИИ ПРАВИЛА/РОЛИ (объединяет узлы "Вариант C · Детализация задачи" hGHjj/M39uQ И "Вариант C · Детализация правила" HNAzP/rdmcp — это ОДИН и тот же компонент с разными данными, не два): новый файл ui/RuleGroupDetailsPanel.tsx (или назови иначе, но зафиксируй финальное имя в отчёте). Проп-контракт: { title: string, rules: SalaryReportRule[], direction: SalaryDirection, open: boolean, onClose: () => void }. Строение — SidePanel (title=title, footer = "Итого по {роли/задаче}" + formatCurrency(суммаFact) по всем rules):
- Sum-блок сверху body: суммарные factPrognose по rules (sumAllFactPrognose), крупно факт слева / прогноз справа, как LedgerHero, можно буквально переиспользовать тот же визуальный приём (не обязательно сам компонент, у него другие пропсы).
- Тело — ОБЯЗАТЕЛЬНО группировка по правилам: rules.map(rule => <LedgerRuleRow rule={rule} direction={direction} isExpanded={...} onToggle={...} />) — ИМЕННО переиспользовать существующий LedgerRuleRow (он уже сам разворачивает RuleSourcesRail на клик), локальный Set-стейт развёрнутых ruleId живёт внутри нового компонента (это презентационный UI-стейт панели, не бизнес-логика, не нужно тащить в useSalaryReportSelection). Когда rules.length === 1 (случай "задачи" — один TaskCompletion-правило) панель просто покажет одну строку правила, это ожидаемо и нормально, НЕ нужно скрывать эту группировку для одного элемента.
- НИКАКИХ полей "Статус"/"Срок"/"Ответственный"/"История начислений" — их нет в контракте, значит их не будет в панели, независимо от того, что нарисовано в мокапе hGHjj/M39uQ.

ПАНЕЛЬ ДЕТАЛИЗАЦИИ ПЛАНА ПРОДАЖ (узлы "Вариант C · План продаж (панель)" z8SOOH десктоп / "Вариант C · Моб. · План продаж" Y37PA6 мобайл): новый файл ui/SalesPlanDetailsPanel.tsx. Проп-контракт: { label: string, period: string, isPlanApproved: boolean, salesPerformance: SalesPerformanceSummary[], open: boolean, onClose: () => void }. SidePanel (title="План продаж · " + label):
- Hero: суммарная Выручка (sum salesPerformance[].fact.turnover) и Маржа (sum ...fact.margin) — два крупных числа рядом (используй formatCurrency из @/features/SalesPlan).
- Body — по одной секции на salesPerformance[] (переиспользуй ui/SalesPlanCardV2.tsx текущую внутреннюю логику категории: имя категории через useShopCategoryNames, "осталось N ₽", прогресс-трек, "{percentCompletion}% · прогноз {forecastPercent}%", мини-таблица Выручка/Маржа План/Факт/Прогноз). Эта логика ("SalesPlanCategoryRow"+"MetricRow"+"progressToneClassName"+"performanceTextClassName") СЕЙЧАС определена ЛОКАЛЬНО внутри SalesPlanCardV2.tsx (не экспортируется) — ВЫНЕСИ её в отдельный файл ui/SalesPlanCategoryRow.tsx с экспортами и переключи SalesPlanCardV2.tsx на импорт оттуда, чтобы карточка (мини-тизер использует только 1-ю категорию либо сводку) и новая панель (показывает ВСЕ категории) не дублировали код.
- Footer: "Выполнение плана {X}%" — X = Math.round(sum(fact.turnover) / sum(plan.turnover) * 100), 0 если sum(plan.turnover)===0.

ОБЩИЕ ПРАВИЛА КОДА: TypeScript strict, без any; комментарии и тексты UI на русском; без новых npm-зависимостей; никаких новых donut/pie-визуализаций и никаких выдуманных полей данных; используй Tailwind-токены UI-кита (bg-canvas, bg-surface, border-hairline, text-ink, text-ink-muted, brand, warn и т.п. — смотри соседние файлы). После правок из ${ROOT}/frontend запускай npm run lint && npm run build и чини свои ошибки.`

const FOUNDATION = CONTEXT + `

ТВОЯ ЗАДАЧА — ФУНДАМЕНТ (другие агенты будут параллельно строить бенто-карточки поверх твоих компонентов, поэтому интерфейсы должны быть финальными и задокументированными в твоём отчёте):
1) pages/SalaryReportV2/model/groupRulesByType.ts — splitRulesByType(rules: SalaryReportRule[]): { taskRules: SalaryReportRule[], roleRules: SalaryReportRule[] } (taskRules = type==='TaskCompletion'). Роль-группировка ролевых правил и так есть в model/groupRulesByRole.ts — переиспользуй её, не переписывай.
2) pages/SalaryReportV2/ui/RuleGroupDetailsPanel.tsx — см. контракт и требования по группировке ПО ПРАВИЛАМ (rules.map -> LedgerRuleRow) в контексте выше. Обязательно переиспользуй существующие LedgerRuleRow/RuleSourcesRail/sumAllFactPrognose, не копируй их логику.
3) pages/SalaryReportV2/ui/SalesPlanCategoryRow.tsx — вынеси туда SalesPlanCategoryRow/MetricRow/progressToneClassName/performanceTextClassName из текущего SalesPlanCardV2.tsx (с экспортами), переключи SalesPlanCardV2.tsx на импорт из нового файла. Не меняй видимое поведение SalesPlanCardV2 при этом переносе.
4) pages/SalaryReportV2/ui/SalesPlanDetailsPanel.tsx — см. контракт выше (Hero с суммарной выручкой/маржой, Body — все категории через перенесённый SalesPlanCategoryRow, Footer — "Выполнение плана X%").
5) npm run lint && npm run build (frontend/) должны проходить для этих файлов (ошибки в файлах, которые тебе не принадлежат — просто зафиксируй в отчёте, их поправит Integrate).
6) В ответе верни ТОЧНЫЕ финальные имена файлов и пропсов обеих панелей (RuleGroupDetailsPanel, SalesPlanDetailsPanel) и splitRulesByType — это будет передано UI-агентам буквально.`

const UI_TOTALS_TASKS = (foundation) => CONTEXT + `

ФУНДАМЕНТ УЖЕ ГОТОВ (другой агент). Его отчёт:
${foundation}

ТВОЯ ЗАДАЧА — левая колонка бенто-раскладки сотрудника ("Колонка · Зарплата" в мокапе YCxrT/L2Ztk), в pages/SalaryReportV2/ui/:
1) TotalsBentoCard.tsx — карточка-обёртка (rounded-xl border border-hairline bg-surface, паддинг как у соседних карточек) вокруг СУЩЕСТВУЮЩЕГО ui/LedgerHero.tsx (передай ему report.grandTotal/report.isClosed как раньше делала LedgerCard) — просто новая обёртка, логику самого героя (факт/прогноз/дельта) не трогай и не копируй.
2) TaskSourceCard.tsx — карточка "Источник · Задачи": принимает taskRules: SalaryReportRule[] (правила type==='TaskCompletion' из ОБОИХ направлений, объединённые — вызывающая сторона это уже сделает через splitRulesByType фундамента) + callback onOpenRuleGroup(title: string, rules: SalaryReportRule[], direction: SalaryDirection) для открытия панели. Шапка: точка + "Задачи" + мета "N правил" (taskRules.length) — если хочешь показать и число задач, посчитай его как сумму rule.sources.length по всем taskRules (это реально существующие данные, не выдумка). Сумма fact/prognose по всем taskRules (sumAllFactPrognose). Затем НЕ-раскрывающиеся строки — одна на правило: название, прогресс-трек = clamp(fact/prognose*100,0,100) (если prognose null/0 — трек 100% или скрой его, не деля на 0), факт, прогноз, шеврон. onClick строки -> onOpenRuleGroup(rule.name, [rule], rule.direction) — ВАЖНО: SalaryReportRule сам по себе не хранит direction, тебе придётся прокинуть его вместе с правилом от вызывающей стороны (например, обогати taskRules каждым direction перед передачей в этот компонент, или прими проп в форме { rule: SalaryReportRule, direction: SalaryDirection }[] вместо чистого SalaryReportRule[] — выбери сам и явно задокументируй в JSDoc, это тебе решать как автору компонента).
3) Оба компонента — чисто презентационные (без бизнес-состояния, без запросов), русские подписи, Tailwind UI-kit токены как в соседних карточках (смотри aB1Lq/ydIk9 в мокапе YCxrT для отступов/размеров, прочитай их через mcp__pencil__execute перед вёрсткой).
4) npm run lint && npm run build (ошибки в чужих файлах — просто перечисли, их поправит Integrate).
5) В отчёте зафиксируй финальные пропсы TotalsBentoCard/TaskSourceCard и как ты решил проблему с direction у правила из п.2 — это нужно интегратору.`

const UI_DIRECTIONS = (foundation) => CONTEXT + `

ФУНДАМЕНТ УЖЕ ГОТОВ (другой агент). Его отчёт:
${foundation}

ТВОЯ ЗАДАЧА — правая область бенто-раскладки сотрудника ("Источники" в мокапе YCxrT/L2Ztk: карточки "Источник · Сервис" aB1Lq и "Источник · Магазин" rfz9M), в pages/SalaryReportV2/ui/:
1) DirectionSourceCard.tsx — параметризована направлением. Пропсы примерно: { direction: DirectionReportVM, onOpenRuleGroup(title, rules, direction), onOpenSalesPlan(direction) } (можешь уточнить форму, задокументируй). Внутри:
   - Раздели direction.rules через splitRulesByType фундамента, используй ТОЛЬКО roleRules здесь (taskRules показывает соседняя TaskSourceCard, не дублируй их тут).
   - Шапка: точка направления + direction.label + мета "N ролей · M правил" (N = число групп groupRulesByRole(roleRules, direction.direction), M = roleRules.length).
   - Сумма fact/prognose — ТОЛЬКО по roleRules (sumAllFactPrognose(roleRules.map(r=>r.amount))), не по direction.total (тот включает task-правила).
   - Строки — по одной на РОЛЬ (groupRulesByRole(roleRules, direction.direction)): getRoleLabel(role), прогресс-трек = clamp(суммаFact/суммаPrognose группы *100), сумма факт/прогноз группы, шеврон. onClick -> onOpenRuleGroup(getRoleLabel(role), group.rules, direction.direction) — группа МОЖЕТ содержать несколько правил, это и есть требуемая пользователем группировка, панель (фундамент) уже её показывает построчно.
   - Если direction.salesPerformance.length > 0 (та же проверка hasSalesPerformance, что раньше делала EmployeeReportBodyV2) — мини-тизер плана продаж под строками ролей: "ПЛАН ПРОДАЖ · {direction.label}" + бейдж "Утверждён"/"Не утверждён" (direction.isPlanApproved, те же тона brand-soft/warn-soft что в SalesPlanCardV2) + ссылка "Подробнее" -> onOpenSalesPlan(direction.direction). НЕ рисуй новый donut/pie-чарт — компактная сводка текстом/мини-прогрессом достаточна (проверь сам, нет ли уже готового radial-компонента в shared/ui-kit прежде чем писать что-то новое).
2) Прочитай узлы aB1Lq/rfz9M мокапа YCxrT (и мобильные ORy11/F4veQu из L2Ztk) через mcp__pencil__execute перед вёрсткой — там точные отступы/цвета.
3) npm run lint && npm run build (ошибки в чужих файлах — перечисли, поправит Integrate).
4) В отчёте зафиксируй финальные пропсы DirectionSourceCard.`

const INTEGRATE = (reports) => CONTEXT + `

Фундамент и два UI-блока написаны разными агентами параллельно. Их отчёты:
${reports}

ТВОЯ ЗАДАЧА — ИНТЕГРАЦИЯ:
1) Собери pages/SalaryReportV2/ui/EmployeeReportBodyV2.tsx на новых карточках: TotalsBentoCard + TaskSourceCard в левой колонке (desktop ~448px), DirectionSourceCard на каждое направление в правой области (desktop grid, 1-2 колонки под доступную ширину справа). Мобильный порядок ОБЯЗАН отличаться от десктопного: Итого -> Источник·Сервис -> Источник·Магазин -> Источник·Задачи (см. контекст выше, узел L2Ztk) — десктоп группирует Итого+Задачи слева, Сервис+Магазин справа. Подбери реализацию порядка (раздельные блоки md:hidden/hidden md:block, либо CSS order) сам.
2) Заведи в EmployeeReportBodyV2.tsx (или в небольшом локальном хуке рядом, НЕ в useSalaryReportSelection — это чисто UI-стейт панели, не бизнес-состояние) стейт "какая панель открыта": для RuleGroupDetailsPanel — { title, rules, direction } | null, для SalesPlanDetailsPanel — SalaryDirection | null (данные для неё берёшь из report.directions по этому direction). Прокинь onOpenRuleGroup/onOpenSalesPlan колбэками в TaskSourceCard/DirectionSourceCard, отрендери оба \\*DetailsPanel один раз на странице тела.
3) Сохраняющиеся вопросы по старым файлам решай ТОЛЬКО через grep, не угадывай:
   - LedgerCard.tsx и LedgerDirectionBlock.tsx после этой замены скорее всего становятся МЁРТВЫМИ (использовались только старым EmployeeReportBodyV2) — grep их использования по всему frontend/src; если ноль использований вне них самих — удали файлы.
   - LedgerRoleGroup.tsx — вероятно тоже осиротеет (использовался только LedgerDirectionBlock) — то же самое: grep и удали, если действительно не используется. LedgerRuleRow.tsx/RuleSourcesRail.tsx/LedgerHero.tsx/DeltaBadge.tsx/model/deltaTone.ts/model/ledgerColumns.ts — ЭТИ переиспользуются новыми компонентами и/или Department-стороной — НЕ удаляй без grep-проверки, скорее всего они остаются.
   - features/SalaryReportData/model/useSalaryReportSelection.ts содержит isDirectionExpanded/onToggleDirection/collapsedDirectionKeys (сворачивание блока направления в старом LedgerDirectionBlock) — если после замены EmployeeReportBodyV2Props эти поля больше НИКЕМ не читаются (grep по всему frontend/src, включая Department-сторону) — удали их из хука и из EmployeeReportBodyV2Props/model/useSalaryReportPage.ts. НЕ трогай isRuleExpanded/onToggleRule/expandedRuleKeys в этом хуке — судя по его же комментарию, они общие с отчётом ОТДЕЛА (DepartmentEmployeeGroupV2 и т.п.) и почти наверняка ещё нужны там, даже если новый EmployeeReportBodyV2 больше не читает их напрямую (панель детализации теперь использует свой ЛОКАЛЬНЫЙ стейт раскрытия, не общий Set) — просто убери проброс через EmployeeReportBodyV2Props, если он для сотрудника больше не нужен, но саму инфраструктуру в хуке проверь на использование Department-стороной перед удалением.
4) npm run lint && npm run build — почини все ошибки (типы, границы FSD, неиспользуемые импорты/файлы).
5) Открой в браузере через Playwright (mcp__playwright__browser_navigate/browser_snapshot/browser_take_screenshot/browser_resize — загрузи через ToolSearch) http://localhost:<порт из npm run start>/salaries: выбери сотрудника с данными в обоих направлениях, проверь desktop 1440 — карточки Итого/Задачи слева, Сервис/Магазин справа, клик по роли с несколькими правилами открывает панель и показывает КАЖДОЕ правило отдельной строкой (не один плоский список заказов), клик по задаче открывает панель с одним правилом, "Подробнее" на плане продаж открывает панель с агрегированной выручкой/маржой; проверь mobile 390 — карточки идут в порядке Итого/Сервис/Магазин/Задачи, панели превращаются в bottom sheet. Проверь, что режим "Отдел" (/salaries со scope=department) НЕ пострадал — открывается и рендерится как раньше. Останови dev server после проверки.
6) Верни: что починил, что удалил (с подтверждением grep), что проверил в браузере, что осталось непроверенным и почему.`

const REVIEW = (integ) => CONTEXT + `

Реализация завершена. Отчёт интегратора:
${integ}

ТВОЯ ЗАДАЧА — КОД-РЕВЬЮ (чтение + точечные правки очевидных дефектов): git diff в frontend/src/pages/SalaryReportV2/. Проверь СТРОГО:
1) Ни в одном новом файле НЕТ полей "Статус"/"Срок"/"Ответственный"/"История начислений" или любых других данных, которых нет в SalaryReportRule/EmployeeSalaryReportSource/SalesPerformanceSummary — пользователь явно запретил выдумывать данные под мокап.
2) Панель детализации роли/правила действительно группирует ПО ПРАВИЛАМ (переиспользует LedgerRuleRow на каждый rule), а не сплющивает sources всех правил роли в один список.
3) Обе новые панели используют shared/ui-kit/organisms/SidePanel.tsx, а не самодельный modal/drawer.
4) frontend/CLAUDE.md конвенции: model/api.ts не нарушен, mediator/страница без ветвлений, только import type из ireports-contracts, границы FSD (pages не импортирует другую page; features не импортирует другую feature), без any.
5) Department-сторона (DepartmentReportBodyV2 и Department*-компоненты) не изменена и не сломана.
6) Удалённые файлы реально были мёртвым кодом (не осталось битых импортов).
7) React-ключи в списках, aria-expanded на кликабельных строках/шевронах, русские тексты без опечаток.
Очевидные баги почини сам и перепроверь npm run lint && npm run build. Верни список найденного: что починил, что оставил как замечание (файл:строка, суть).`

const SCHEMA_TEXT = { type: 'object', properties: { report: { type: 'string' } }, required: ['report'] }

phase('Foundation')
const foundation = await agent(FOUNDATION, { label: 'foundation', phase: 'Foundation', schema: SCHEMA_TEXT })
if (!foundation) throw new Error('foundation agent failed')
log('Фундамент готов (панели детализации + группировка), запускаю UI параллельно')

phase('UI')
const [totalsTasks, directions] = await parallel([
  () => agent(UI_TOTALS_TASKS(foundation.report), { label: 'ui:totals-tasks', phase: 'UI', schema: SCHEMA_TEXT }),
  () => agent(UI_DIRECTIONS(foundation.report), { label: 'ui:directions', phase: 'UI', schema: SCHEMA_TEXT }),
])
const uiReports = `--- ИТОГО+ЗАДАЧИ ---\n${totalsTasks ? totalsTasks.report : 'АГЕНТ УПАЛ — проверь состояние TotalsBentoCard/TaskSourceCard сам'}\n--- НАПРАВЛЕНИЯ ---\n${directions ? directions.report : 'АГЕНТ УПАЛ — проверь состояние DirectionSourceCard сам'}`

phase('Integrate')
const integ = await agent(INTEGRATE(`--- ФУНДАМЕНТ ---\n${foundation.report}\n${uiReports}`), { label: 'integrate', phase: 'Integrate', schema: SCHEMA_TEXT })

phase('Review')
const review = await agent(REVIEW(integ ? integ.report : 'интегратор упал — начни с npm run lint && npm run build'), { label: 'review', phase: 'Review', schema: SCHEMA_TEXT })

return { foundation: foundation.report, totalsTasks: totalsTasks && totalsTasks.report, directions: directions && directions.report, integrate: integ && integ.report, review: review && review.report }

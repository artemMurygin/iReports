export const meta = {
  name: 'salary-report-frontend',
  description: 'Реализовать страницу /salaries (отчёт сотрудника и отдела) по макетам Pencil',
  phases: [
    { title: 'Foundation', detail: 'api, хуки, роут, скелет страницы, контракты пропсов' },
    { title: 'UI', detail: 'параллельно: UI сотрудника и UI отдела' },
    { title: 'Integrate', detail: 'сборка, lint, build, починка' },
    { title: 'Review', detail: 'ревью по конвенциям frontend/CLAUDE.md' },
  ],
}

const ROOT = '/Users/artemmurygin/Desktop/iReapir/iReports/iReports'
const PEN = ROOT + '/design/sallary-first-iteration.pen'

const CONTEXT = `
ПРОЕКТ: монорепо iReports, фронтенд в ${ROOT}/frontend (React 19 + Vite + TS, TanStack Query, React Router, Tailwind, FSD). ОБЯЗАТЕЛЬНО прочитай ${ROOT}/frontend/CLAUDE.md (конвенции: model/api.ts с queryOptions-фабриками, mediator-хуки useXPage с плоским объектом без &&/тернарников в самом page-компоненте, слоты вместо children, RefreshTransitionLayout, isInitialLoad/isRefreshing, UI Kit в shared/ui-kit (старый shared/ui не расширять), только "import type" из 'ireports-contracts' — рантайм-импорт ломает Vite dev server, границы импортов FSD через eslint-plugin-boundaries).
ПЛАН РЕАЛИЗАЦИИ: /Users/artemmurygin/.claude/plans/quirky-purring-graham.md — прочитай целиком; он описывает структуру pages/SalaryReport.
ЭТАЛОНЫ КОДА: ${ROOT}/frontend/src/pages/SalaryRuleList (страница с фильтрами и mediator-хуком), pages/SalesPlan, pages/ServicesReport (isInitialLoad/isRefreshing), features/TargetDirectory (useDepartments/useEmployees для селектов), features/SalesPlan (PeriodPicker, форматтеры formatCurrency и др. — часть НЕ экспортирована из index.ts, план предписывает расширить экспорт), shared/ui-kit (atoms: Button, SegmentedControl, Select/Input, Chip; molecules: KpiCard, CellProgress; organisms: PageHeader).
КОНТРАКТЫ: ${ROOT}/contracts/commands/salary-rule.ts — EmployeeSalaryReportResponse { period, direction, isClosed, total:{fact,prognose|null}, rules[] (employeeSalaryReportRuleSchema: name, type, targetRole, total, appliedPercent/floatPercent-инфо, sources[] — заказы), salesPerformance (план по категориям), isPlanApproved }; DepartmentSalaryReportResponse { period, isClosed, department, employees[{employeeId,name,total,rules[]}], total }. Прочитай файл, чтобы точно знать поля (в т.ч. floatPercentInfoSchema, salesPerformanceSummarySchema, factPrognoseAmountSchema). prognose = null для закрытого периода.
ЭНДПОИНТЫ (${ROOT}/ENDPOINTS.md): GET /v1/{service|shop}/accounting/salary_report/employee/:employeeId/:period и GET /v1/{service|shop}/accounting/salary_report/department/:departmentId/:period.
РОУТИНГ: ${ROOT}/frontend/src/app/router.tsx (добавить { path: 'salaries', element: <SalaryReportPage /> } внутри <Layout>), навигация ${ROOT}/frontend/src/app/navigation.tsx — у пункта «Отчёт по зарплате» (to: '/salaries') убрать disabled: true.

МАКЕТЫ PENCIL (утверждены пользователем): файл ${PEN}, зашифрован — читать ТОЛЬКО через mcp__pencil__* (загрузи одним ToolSearch "select:mcp__pencil__get_app_state,mcp__pencil__execute,mcp__pencil__get_screenshot"; затем get_app_state({include_schema:true,include_canvas_design:true,include_scripts_and_shaders:false}); структуру читай через execute: Get(id, (n,ctx)=>{ Print(...); return true; }) — без top-level return, Print вместо console; скриншоты — get_screenshot(nodeId)).
- t3QCM — «Зарплата сотрудника · Вариант 2 (Две колонки)», десктоп 1440: Topnav → Page Header → Filter Row (селект сотрудника, период) → Columns: СЛЕВА KPI-ряд «Начислено всего · факт» / «Прогноз до конца месяца», затем секции «Сервис» и «Магазин»: шапка направления с итогом факт/прогноз, таблица правил [экспандер][Правило + мета][% «3,5% → 4,0%» только у KPI-правил с плавающим процентом, у фиксированных пусто][Факт ₽][Прогноз ₽]; раскрытие правила → подтаблица заказов (Документ · Устройство/работа · Факт · Прогноз) + «Показать все заказы (N)». СПРАВА колонка 404: карточки «План продаж · Сервис» (Q3K5O) и «План продаж · Магазин» (jdMCD) с бейджем «Утверждён»/«Не утверждён»; строка категории: название + «осталось N ₽» справа, прогрессбар, «84% · прогноз 96%»; прогноз ≥100% — зелёный текст ($ok-ink), выполнение <80% — оранжевый ($warn).
- Z0lgF — то же, мобайл 390: App Bar → поля Сотрудник/Период → 2 KPI → карточки «Сервис»/«Магазин» (строка правила: название + процент; справа факт крупно/прогноз приглушённо; раскрытие в заказы) → карточки плана.
- b6mfxv — «Отчёт: Зарплата отдела · v2 (Десктоп)»: Filter Row (селект отдела, Segmented Сервис|Магазин, период) → 2 KPI по отделу → таблица сотрудников [экспандер][Сотрудник: аватар-инициалы + имя + роль][Правил][Факт][Прогноз]; раскрытие сотрудника → плоская таблица его правил (Правило · % у KPI-правил · Факт · Прогноз), БЕЗ заказов. Блока плана нет.
- d8XFk — отдел, мобайл 390: поля Отдел/Период + Segmented → 2 KPI → карточки сотрудников, раскрытие → список правил (без заказов).
ПРАВИЛА СЕМАНТИКИ: Факт — начислено; Прогноз — к концу месяца, может быть ниже факта (не красить красным); закрытый период — prognose null → колонку/значение прогноза не показывать (или «—» с бейджем «Месяц закрыт»). У фиксированных правил (нет floatPercent) проценты не показывать вовсе. Отчёт сотрудника = два параллельных запроса (service + shop) с суммированием на фронте; направление, вернувшее 404/пусто (сотрудник не работает в нём) — секцию не рендерить, не считать ошибкой всей страницы. Отчёт отдела — один запрос по выбранному направлению.
ОБЩИЕ ПРАВИЛА КОДА: TypeScript strict, без any; комментарии и тексты UI на русском; без новых зависимостей; Tailwind-токены UI-кита (bg-canvas, bg-surface, border-hairline, text-ink, text-ink-muted, brand, warn и т.д. — посмотри существующие компоненты shared/ui-kit и tailwind-конфиг); не трогай файлы вне своей зоны ответственности. После правок запускай из ${ROOT}/frontend: npm run lint и npm run build (tsc -b && vite build) и чини свои ошибки.`

const FOUNDATION = CONTEXT + `

ТВОЯ ЗАДАЧА — ФУНДАМЕНТ (остальные агенты будут параллельно писать UI поверх твоих типов, поэтому интерфейсы должны быть финальными и задокументированными):
1) ${ROOT}/frontend/src/features/SalesPlan/index.ts — доэкспортировать форматтеры (formatCurrency, formatNumber, formatPercent, formatSignedCurrency — проверь реальные имена в features/SalesPlan/model/format.ts) и PeriodPicker, если ещё не экспортирован.
2) pages/SalaryReport/model/api.ts — queryOptions-фабрики getEmployeeSalaryReport(direction, employeeId, period) и getDepartmentSalaryReport(direction, departmentId, period) по конвенции проекта (см. pages/ServicesReport/model/api.ts и shared/api), типы — import type из ireports-contracts, ошибки через ApiError.
3) pages/SalaryReport/model/types.ts — вью-модели для UI: SalaryDirection ('service'|'shop'), DirectionReportVM { direction, label, total, rules, salesPerformance, isPlanApproved, isClosed }, EmployeeReportVM { directions: DirectionReportVM[], grandTotal {fact, prognose|null}, isClosed }, DepartmentReportVM и т.п. Хелперы: isFloatPercentRule(rule) → показывать ли проценты; getRulePercents(rule) → {fact, prognose}|null; сумма fact/prognose с учётом null.
4) pages/SalaryReport/model/useEmployeeSalaryReport.ts (useQueries на оба направления, enabled при выбранном сотруднике; 404 по направлению = направление отсутствует, не ошибка), useDepartmentSalaryReport.ts (useQuery), useSalaryReportPage.ts — mediator с плоским объектом: scope 'employee'|'department', period (+setPeriod, дефолт текущий месяц в формате, который ожидает бэкенд — посмотри PeriodPicker/isValidPeriod), employeeId/departmentId (+setters), direction для отдела (+setter), expanded-наборы (toggleRule(key), toggleEmployee(id), isRuleExpanded, isEmployeeExpanded), справочники employees/departments из features/TargetDirectory с флагами загрузки, isInitialLoad/isRefreshing/errorMessage, employeeReport: EmployeeReportVM|null, departmentReport: DepartmentReportVM|null.
5) pages/SalaryReport/ui/SalaryReportPage.tsx — страница: PageHeader (крошки «Зарплата / Отчёт по зарплате»), SalaryReportFilters (scope SegmentedControl «Сотрудник | Отдел», селект сотрудника или отдела, SegmentedControl направления только для отдела, PeriodPicker; десктоп + мобильная раскладка по макетам) и два тела: <EmployeeReportBody .../> и <DepartmentReportBody .../>. СОЗДАЙ ЗАГЛУШКИ ui/EmployeeReportBody.tsx и ui/DepartmentReportBody.tsx с ФИНАЛЬНЫМИ пропсами (типы экспортируй из ui/EmployeeReportBody.types.ts / ui/DepartmentReportBody.types.ts или из model/types.ts): EmployeeReportBodyProps { report: EmployeeReportVM|null, isLoading, errorMessage, isEmployeeSelected, isRuleExpanded(key), onToggleRule(key) }; DepartmentReportBodyProps { report: DepartmentReportVM|null, isLoading, errorMessage, isDepartmentSelected, isEmployeeExpanded(id), onToggleEmployee(id) }. Заглушки рендерят простой placeholder. pages/SalaryReport/index.ts экспортирует SalaryReportPage.
6) Роут 'salaries' в app/router.tsx, включить пункт навигации в app/navigation.tsx.
7) npm run lint && npm run build должны проходить. В ответе перечисли созданные файлы и ТОЧНЫЕ сигнатуры пропсов/вью-моделей (это будет передано UI-агентам).`

const UI_EMPLOYEE = (foundation) => CONTEXT + `

ФУНДАМЕНТ УЖЕ ГОТОВ (другой агент). Его отчёт:
${foundation}

ТВОЯ ЗАДАЧА — UI ОТЧЁТА СОТРУДНИКА в pages/SalaryReport/ui/ по макетам t3QCM (десктоп) и Z0lgF (мобайл). Реализуй EmployeeReportBody.tsx (замени заглушку, пропсы НЕ меняй) и его подкомпоненты:
- SalaryTotalsKpi.tsx — две KPI-карточки «Начислено всего · факт» / «Прогноз до конца месяца» (KpiCard из shared/ui-kit; при isClosed — одна карточка факта + бейдж «Месяц закрыт»).
- DirectionSection.tsx — секция направления: шапка (название, «N правил», итог факт/прогноз) + RulesTable.
- RulesTable.tsx (десктоп-таблица) и RulesList.tsx (мобильные строки-карточки): строка правила — экспандер, название + мета (тип правила человекочитаемо, роль), проценты «3,5% → 4,0%» только если isFloatPercentRule, Факт, Прогноз; раскрытие → RuleSourcesTable/List (заказы: документ, описание, факт, прогноз) с локальным «Показать все заказы (N)» (по умолчанию 3 строки).
- SalesPlanCard.tsx — карточка плана направления: заголовок «План продаж · Сервис», подпись периода, бейдж «Утверждён»/«Не утверждён» (Chip), список категорий (название, «осталось N ₽», прогрессбар, «84% · прогноз 96%»), цвета: прогноз ≥100% — зелёный текст, выполнение <80% — warn-бар/текст. Поля бери из salesPerformance контракта (прочитай salesPerformanceSummarySchema; если прогноза % в контракте нет — выведи из имеющихся полей или покажи только то, что есть, и явно напиши об этом в отчёте).
- Раскладка: десктоп — grid 2 колонки (левая fill, правая 404px), мобайл (md:hidden) — стопка по Z0lgF: KPI → секции направлений → карточки плана. Состояния: сотрудник не выбран (пустое состояние с подсказкой), загрузка (скелетоны), ошибка, направления без данных не рендерятся.
Вся условная отрисовка — внутри этих презентационных компонентов. Не трогай model/*, SalaryReportPage.tsx, файлы отдела (DepartmentReportBody и его подкомпоненты). Если нужен общий компонент с отделом (например, строка правила) — создай его в ui/shared/RuleRow.tsx и опиши в отчёте, агент отдела сможет переиспользовать при интеграции. По завершении npm run lint и npm run build в frontend должны проходить (ошибки в чужих файлах — просто перечисли).`

const UI_DEPARTMENT = (foundation) => CONTEXT + `

ФУНДАМЕНТ УЖЕ ГОТОВ (другой агент). Его отчёт:
${foundation}

ТВОЯ ЗАДАЧА — UI ОТЧЁТА ОТДЕЛА в pages/SalaryReport/ui/ по макетам b6mfxv (десктоп) и d8XFk (мобайл). Реализуй DepartmentReportBody.tsx (замени заглушку, пропсы НЕ меняй) и подкомпоненты:
- DepartmentTotalsKpi.tsx — две KPI-карточки «Начислено по отделу · факт» (подпись «N сотрудников») / «Прогноз до конца месяца» (при isClosed — факт + бейдж «Месяц закрыт»).
- EmployeesTable.tsx (десктоп): колонки экспандер · Сотрудник (аватар-инициалы + имя + роль, роль человекочитаемо из targetRole правил: ENGINEER «Инженер», ONLINE_MANAGER «Онлайн-менеджер», OFFLINE_MANAGER «Офлайн-менеджер», ORDER_MANAGER «Менеджер заказа», ONLINE_PURCHASER «Онлайн-закупщик», OFFLINE_PURCHASER «Офлайн-закупщик») · Правил · Факт · Прогноз; раскрытие сотрудника → вложенная плоская таблица его правил (Правило + мета · % «3,5% → 4,0%» только у правил с плавающим процентом · Факт · Прогноз), БЕЗ заказов и без экспандеров у правил.
- EmployeesList.tsx (мобайл, md:hidden): карточки сотрудников (имя + «Роль · N правил», справа факт крупно / «→ прогноз» приглушённо, шеврон), раскрытие → список правил (название + проценты у KPI-правил / «Фиксированная сумма» у остальных, справа факт/прогноз).
- Состояния: отдел не выбран (пустое состояние), загрузка (скелетоны), ошибка, пустой отдел («Нет сотрудников с начислениями»).
Словарь человекочитаемых ролей и типов правил вынеси в pages/SalaryReport/model/labels.ts (если агент сотрудника создаст свой — при интеграции объединят; назови экспорты ROLE_LABELS, RULE_TYPE_LABELS, getRoleLabel, getRuleTypeLabel). Не трогай model/api|hooks, SalaryReportPage.tsx и файлы сотрудника (EmployeeReportBody и его подкомпоненты). По завершении npm run lint и npm run build в frontend должны проходить (ошибки в чужих файлах — перечисли).`

const INTEGRATE = (reports) => CONTEXT + `

Фундамент и два UI-блока написаны разными агентами параллельно. Их отчёты:
${reports}

ТВОЯ ЗАДАЧА — ИНТЕГРАЦИЯ:
1) cd ${ROOT}/frontend && npm run lint && npm run build — почини все ошибки (типы, границы FSD, неиспользуемые импорты).
2) Устранить дубли: если есть два словаря labels / две реализации строки правила / дублирующие форматтеры — оставить один, переключить импорты.
3) Проверить SalaryReportPage.tsx: mediator-конвенция (без &&/тернарников в page-компоненте), тела получают нужные пропсы, пункт навигации включён, роут есть.
4) Прогнать в браузере: подними dev server (npm run start или npm run dev в frontend — посмотри package.json; бэкенд может быть недоступен — тогда проверь хотя бы рендер пустых/ошибочных состояний) и через Playwright MCP (mcp__playwright__browser_navigate/browser_snapshot/browser_take_screenshot/browser_resize; загрузи через ToolSearch) открой http://localhost:<порт>/salaries: переключи Сотрудник/Отдел, выбери сотрудника/отдел, проверь десктоп (1440) и мобайл (390) — консольных ошибок нет, раскладка соответствует макетам. Останови dev server после проверки.
5) Верни: что починил, что проверил в браузере (с портом и результатами), что осталось непроверенным и почему.`

const REVIEW = (integ) => CONTEXT + `

Реализация завершена. Отчёт интегратора:
${integ}

ТВОЯ ЗАДАЧА — КОД-РЕВЬЮ (только чтение + точечные правки очевидных дефектов): git diff и новые файлы в frontend/src/pages/SalaryReport, app/router.tsx, app/navigation.tsx, features/SalesPlan/index.ts. Проверь по frontend/CLAUDE.md: конвенции model/api.ts, mediator без ветвлений, только import type из ireports-contracts, границы FSD (pages не импортирует из других pages; features не импортирует pages), отсутствие any, корректную обработку prognose=null, суммирование двух направлений, 404 по направлению не валит страницу, ключи React в списках, доступность кнопок-экспандеров (aria-expanded), русские тексты без опечаток. Очевидные баги почини сам и перепроверь npm run lint && npm run build. Верни список найденного: что починил, что оставил как замечание (файл:строка, суть).`

const SCHEMA_TEXT = { type: 'object', properties: { report: { type: 'string' } }, required: ['report'] }

phase('Foundation')
const foundation = await agent(FOUNDATION, { label: 'foundation', phase: 'Foundation', schema: SCHEMA_TEXT })
if (!foundation) throw new Error('foundation agent failed')
log('Фундамент готов, запускаю UI параллельно')

phase('UI')
const [emp, dept] = await parallel([
  () => agent(UI_EMPLOYEE(foundation.report), { label: 'ui:employee', phase: 'UI', schema: SCHEMA_TEXT }),
  () => agent(UI_DEPARTMENT(foundation.report), { label: 'ui:department', phase: 'UI', schema: SCHEMA_TEXT }),
])
const uiReports = `--- СОТРУДНИК ---\n${emp ? emp.report : 'АГЕНТ УПАЛ — проверь состояние файлов EmployeeReportBody и подкомпонентов сам'}\n--- ОТДЕЛ ---\n${dept ? dept.report : 'АГЕНТ УПАЛ — проверь состояние файлов DepartmentReportBody и подкомпонентов сам'}`

phase('Integrate')
const integ = await agent(INTEGRATE(`--- ФУНДАМЕНТ ---\n${foundation.report}\n${uiReports}`), { label: 'integrate', phase: 'Integrate', schema: SCHEMA_TEXT })

phase('Review')
const review = await agent(REVIEW(integ ? integ.report : 'интегратор упал — начни с npm run lint && npm run build'), { label: 'review', phase: 'Review', schema: SCHEMA_TEXT })

return { foundation: foundation.report, employee: emp && emp.report, department: dept && dept.report, integrate: integ && integ.report, review: review && review.report }
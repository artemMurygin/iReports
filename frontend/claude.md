# CLAUDE.md

Этот файл содержит рекомендации для Claude Code (claude.ai/code) при работе с кодом в данном репозитории.

Frontend является частью монорепозитория iReports. Общую информацию о продукте и архитектуре см. в [корневом CLAUDE.md](../CLAUDE.md). Этот файл описывает команды и соглашения, специфичные для frontend.

## Граф знаний (`/graphify`)

Для вопросов об архитектуре, связях между слоями FSD или «что от чего зависит» сначала проверяй `graphify-out/graph.json` в корне репозитория и используй `/graphify query "<вопрос>"` — это быстрее и точнее, чем ручной grep по `pages`/`features`/`shared`. Граф локальный (в `.gitignore`), после крупных переносов/переименований файлов перестраивай его через `/graphify --update`. Подробнее — в [корневом CLAUDE.md](../CLAUDE.md#knowledge-graph-graphify).

## Команды

Запускайте команды из `frontend/`.

Все конфигурационные файлы инструментов (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`,
`eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `components.json`, `vite.config.ts`) находятся
в корне `frontend/`, поэтому `vite`/`tsc`/`eslint`/`prettier`/`npx shadcn add ...` автоматически
используют их без дополнительных флагов.

```bash
npm run start           # vite
npm run build            # tsc -b && vite build
npm run lint              # eslint . (включает правила границ FSD, см. ниже)
npm run format             # prettier --write .
npm run format:check
npm run preview
```

Тестовый раннер в `package.json` не настроен — не следует предполагать, что `npm test` работает.

## Архитектура: Feature-Sliced Design

Приложение построено по принципам **Feature-Sliced Design** с контролем направления импортов на этапе линтинга с помощью `eslint-plugin-boundaries` (см. `eslint.config.js`, правило `boundaries/dependencies`). Слои расположены сверху вниз — от слоя композиции приложения к чистой инфраструктуре:

- **`app`** — запуск приложения и его связывание (`main.tsx`, `router.tsx`, `Layout.tsx`, `Header.tsx`).
  Может импортировать любой слой. Ни один другой слой не может импортировать `app`.
- **`pages`** — отдельная папка для каждого маршрута/экрана (`pages/FunnelReport`, `pages/SalaryReport`,
  `pages/ServicesReport`). Страница может импортировать `features`, `kernel`, `shared` и свои собственные
  подмодули, но **не может импортировать другую страницу** — такие импорты считаются ошибкой линтинга.
- **`features`** — переиспользуемые модули, содержащие бизнес-логику (например, виджеты графиков и
  таблицы), такие как `features/DealsFunnelChart`, `features/ServicesTable`. Могут импортировать
  `kernel`/`shared` и свои собственные подмодули, но **не могут импортировать другие features** —
  кросс-импорты между features запрещены.
- **`kernel`** — глобальные интерфейсы, типы и константы, используемые во всём приложении
  (`kernel/types.ts`, `kernel/chartColors.ts`). Не имеет входящих импортов извне; сам `kernel` может
  импортировать только `kernel`.«kernel ничего не принимает извне, кросс-импорт внутри слоя разрешён» 
- **`shared`** — чистая инфраструктура (API-клиент, универсальные UI-примитивы, хуки, утилиты).
  **Здесь не должно быть бизнес-логики.** `shared` не должен импортировать ничего из других слоёв —
  это самый нижний слой, от которого зависят остальные. «ТУТ ЗАПРЕЩЕНО НАХОДИТЬСЯ ЛЮБОЙ БИЗНЕС ЛОГИКЕ»

`features/<X>` и `pages/<X>` обычно разделяются внутри на `model/` (хуки, получение данных, состояние)
и `ui/` (компоненты) — см. пример `features/DealsTable/{model,ui}` или
`pages/ServicesReport/{mediator,model,ui}`. `pages/ServicesReport` дополнительно содержит папку
`mediator/`, которая координирует несколько features/model-хуков этой страницы — используйте такое
разделение для страниц, которые объединяют несколько stateful-виджетов, вместо того чтобы помещать всё
в один компонент.

Тот же принцип `model`/`ui` применяется и к отдельному крупному компоненту внутри `ui/`, если у него
достаточно собственной логики (стейт, валидация, сайд-эффекты) — он выносится в свой подмодуль
`ui/<Компонент>/{model,ui}` со своим барелем `index.ts`, а не остаётся одним разросшимся файлом. См.
`features/SalesPlan/ui/EditPlanModal/`: `model/useEditPlanForm.ts` держит стейт полей/валидацию/
мутацию сохранения, `ui/` — `EditPlanModal.tsx` (только сборка слотов) плюс презентационные
`EditPlanModalBody.tsx`/`EditPlanModalFooter.tsx`/`EditPlanModalRow.tsx`.

При добавлении нового модуля сначала определите его слой: специфичный для страницы UI/состояние →
`pages/<Page>`; переиспользуемый компонент с бизнес-логикой → новый `features/<Feature>`; общий тип/
константа → `kernel`; универсальная, не зависящая от бизнеса инфраструктура → `shared`. Нарушение
этих границ приведёт к ошибке линтинга, а не просто к замечанию на code review.



### Получение данных

- Для серверного состояния используется **TanStack Query**; Query Client настроен в
  `shared/api/query-client.ts`, экземпляр axios (base URL, interceptors) находится в
  `shared/api/axios.instance.ts`.
- Типы запросов и ответов берутся из workspace-пакета `ireports-contracts`, который используется
  совместно с backend (те же Zod-схемы) — не нужно вручную создавать дублирующие типы для API payload'ов,
  если соответствующий контракт уже существует.
- API-ошибки нормализуются через `shared/errors/apiError.ts`.

### UI

- Идёт переход на новый дизайн (UI Kit из Pencil, `design/sallary-first-iteration.pen`, фрейм
  «ERP · UI Kit (Atomic)»). Новый UI Kit живёт в `shared/ui-kit/` (`tokens/`, `atoms/`,
  `organisms/`) на отдельном наборе токенов (`brand`, `ink`, `canvas`, `surface`, `hairline`,
  `warn`, `danger`, `scrim`, `font-display`, `font-ui`, см. `shared/ui-kit/tokens/theme.css`) —
  **все новые страницы и компоненты добавляйте туда**, а не в `shared/ui/`. `shared/ui/`
  (shadcn-примитивы на старых токенах `--primary`/`--background`) не расширяется новыми
  компонентами и остаётся только для уже существующих, ещё не мигрированных страниц. См.
  `docs/ui-kit-new-header/plan-ui-kit-new-header.md`.
- Используются **Tailwind CSS v4** + **shadcn/radix-ui**. Примитивы старого дизайна находятся в
  `shared/ui/` (`button.tsx`, `select.tsx`, `table.tsx`, `calendar.tsx` и т. д.) — переиспользуйте
  их только на страницах, которые ещё не переведены на новый UI Kit.
- Специализированные для графиков layout-обёртки (`ChartLayout`, `ChartHeader`, `KpiCard`) также
  находятся в `shared/ui/` и используются в аналитических модулях `features/*Chart*`; в качестве
  библиотеки для графиков используется **Recharts**.
- Паттерн, который начинает повторяться в ≥2 страницах/фичах — даже если изначально был написан
  для одной, — выносится в `shared/ui/` вместо копирования в каждое новое место. Пример:
  `RefreshTransitionLayout` (`shared/ui/RefreshTransitionLayout.tsx`) — гейт `isInitialLoad` ->
  `SpinnerPageLg` + fade/blur-переход (`AnimatePresence`/`motion.div`, ключ `dataVersion`) для
  фонового рефетча — вынесен туда после того, как один и тот же код обнаружился в `pages/SalesPlan`,
  `pages/ServicesReport` и `pages/FunnelReport`; теперь все три `Layout.tsx` используют его вместо
  собственной копии `framer-motion`-разметки.
- Алиасы путей и TypeScript project references разделены между `tsconfig.app.json` (код приложения)
  и `tsconfig.node.json` (конфигурация Vite) — см. список references в `tsconfig.json`.
- При развитии проекта проекта, если потребуется стейт менеджер, то используй Zustand. Используй его только для хранения бизнес данных, не допускай лишних зависимостей от стора. 
- Для работы с запросами к серверу - используй TanstackQuery.

## Паттерны

### Публичный API модуля через `index.ts`

Каждый `features/<Feature>/index.ts` реэкспортирует **только** корневой UI-компонент фичи
(например, `export { ServicesChart } from '@/features/ServicesChart/ui/ServicesChart.tsx'`).
Импортировать из фичи следует только через этот `index.ts` (`@/features/ServicesChart`), а не
напрямую из `ui/`/`model/` — так модуль остаётся чёрным ящиком для потребителей и его внутреннюю
структуру можно менять без правок в других слоях.

### Query options factory (`model/api.ts`)

Запросы к backend не оформляются как обычные async-функции — вместо этого в `model/api.ts`
(например, `pages/ServicesReport/model/api.ts`, `pages/FunnelReport/model/api.ts`) определяется
объект `api` с методами, каждый из которых возвращает `queryOptions({...})` из TanStack Query:

```ts
export const api = {
    getServicesAnalytics: (filters, resolvedCategoryIds) =>
        queryOptions({
            queryKey: ['services', 'services-analytics', filters, resolvedCategoryIds],
            queryFn: ({ signal }) =>
                apiInstance
                    .get(...)
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить аналитику по услугам ' + error)
                    }),
        }),
}
```

Результат разворачивается в хуке через `useQuery({ ...api.getX(...), ... })`. Такой подход даёт
переиспользуемые, типобезопасные `queryKey`/`queryFn` без ручного дублирования между местами, где
нужен один и тот же запрос (`useQuery`, `prefetchQuery`, `queryClient.invalidateQueries` и т. д.).

### Нормализация ошибок API

Ошибки сети/API оборачиваются в `ApiError` (`shared/errors/apiError.ts`) прямо в `.catch()` внутри
`queryFn`, с человекочитаемым сообщением на русском (`'Не удалось загрузить ... ' + error`).
Компоненты читают `queryError.message` и не работают с сырыми ошибками axios напрямую.

### `model`-хуки с плоским объектом состояния

Хуки в `model/` (`useFilters`, `useBreadcrumbs`, `useServicesAnalytics`, `usePagination` и т. д.)
инкапсулируют одну зону ответственности и возвращают плоский объект состояния и обработчиков.
Композиция нескольких таких хуков происходит на уровне страницы/mediator-компонента, а не внутри
самих хуков — хуки не знают друг о друге.

### Mediator-компонент для страниц с несколькими виджетами

Для страниц, объединяющих несколько stateful-виджетов (см. `pages/ServicesReport/mediator/ServicesAnalytics.tsx`),
используется отдельный `mediator/`-компонент: он вызывает нужные `model`-хуки, прокидывает их
результат в `ui`-компоненты и не содержит собственной бизнес-логики — только оркестрацию. Это
позволяет держать `ui`-компоненты презентационными (получают готовые данные и колбэки через props),
а логику — сосредоточенной в `model/`.

Тот же принцип действует и на страницах с одним основным виджетом, не только на составных — см.
`pages/SalesPlan/ui/SalesPlanPage.tsx`: весь стейт и обработчики страницы уходят в один
`model/useXPage.ts`-хук с плоским объектом на возврате (`useSalesPlanPage`), а сама страница —
чистая склейка вида `useXPage()` -> пропсы `Layout`/дочерних компонентов. **Медиатор/страница не
должен содержать условного рендера** (`&&`, тернарники, решающие что показать) — любое такое
ветвление выносится в отдельный презентационный компонент (например `SalesPlanBody.tsx`),
которому медиатор просто передаёт уже готовые данные и колбэки как пропсы.

### Слоты вместо `children`

Layout/контейнерные компоненты почти всегда принимают именованные "слоты" — пропсы типа
`ReactNode` (`header`, `body`, `footer`, `actions` и т. п.) — вместо единого `children`
(см. `pages/ServicesReport/ui/Layout.tsx`, `pages/FunnelReport/ui/Layout.tsx`,
`features/DealsTable/ui/TableLayout.tsx`, `shared/ui/ChartHeader.tsx`):

```tsx
type Props = {
    header?: ReactNode
    body?: ReactNode
    footer?: ReactNode
}

export function Layout({ header, body, footer }: Props) {
    return (
        <main>
            {header}
            {body}
            {footer}
        </main>
    )
}
```

Родительский компонент собирает контент для каждого слота отдельно (часто через JSX-фрагмент,
как в `ServicesAnalytics`: `header={<>...</>}` и `body={<>...</>}`) и передаёт их как обычные
пропсы. Единственное исключение — `ChartLayout` (`shared/ui/ChartLayout.tsx`), где слот всего
один и он называется `children`. Используйте именованные слоты, когда контейнер размещает
несколько независимых блоков контента в разных местах разметки — это позволяет компоновать
composition-контейнеры без `children`-магии и без жёсткой связки контейнера с конкретным
содержимым.

Когда содержимое слота — не однострочный JSX, а собирается из нескольких пропсов/компонентов,
вычисляйте его в переменную (`const body = <.../>`, `const footer = <.../>`) выше `return`, а не
инлайньте прямо внутрь JSX-пропса контейнера — так у самого `return` остаётся читаемая форма
`<Layout header={header} body={body} />` (см. `EditPlanModal.tsx` -> `EditPlanModalBody`/
`EditPlanModalFooter`, `SalesPlanPage.tsx` -> `SalesPlanBody`).

### `isInitialLoad` / `isRefreshing` вместо единого `isLoading`

В хуках аналитики (`useServicesAnalytics`, `useDeals`) состояние загрузки разделяется на два
флага: `isInitialLoad` (данных ещё нет — показываем скелетон/спиннер на весь блок) и
`isRefreshing` (данные уже есть, идёт фоновый рефетч — показываем лёгкий индикатор поверх старых
данных). Оба вычисляются из `loading = isDebouncing || isFetching` и `data.length === 0` поверх
`useQuery` с `placeholderData: keepPreviousData`. Используйте это разделение вместо одного общего
`isLoading` там, где смена фильтров не должна "схлопывать" уже отрисованные данные.

# План реализации CRM Dashboard

## Обзор

Верстаем CRM Dashboard из дизайна Pencil в React/TypeScript с использованием shadcn + recharts. Дашборд отражает данные из схемы Prisma (BitrixDeal, BitrixEmployee, BitrixStage, BitrixSource).

---

## Структура страницы (из дизайна)

```
CRM Dashboard (full-page, bg: #f9fafb)
├── Navbar          — лого "CRM Аналитика", иконка колокола, аватар
├── FilterBar       — дата, менеджер, источник, кнопка сброса
└── Main Content (padding 24px, gap 24px, vertical)
    ├── KPI Row     — 4 карточки: лиды, выручка, конверсия, средний чек
    ├── Charts Row  — источники лидов (прогресс-бары) + лиды во времени (line chart)
    ├── Zone 3      — воронка продаж (колонки) + сделки по этапам (список)
    └── Deals Table — полная таблица сделок с пагинацией
```

---

## Моковые данные (на основе Prisma-схемы)

### `mockData.ts`

```ts
// BitrixEmployee
employees: [{ id, firstName, lastName }]

// BitrixSource
sources: [{ id, name }]
// Реклама Google, Facebook, LinkedIn, Эл. почта, Рефералы

// BitrixStage
stages: [{ id, name, color, systemType }]
// Новый (#4f46e5), Квалифицирован (#06b6d4), Предложение (#f59e0b),
// Переговоры (#8b5cf6), Выиграно (#16a34a), Потеряно (#dc2626)

// BitrixDeal (≈15-20 записей)
deals: [{ id, title, opportunity, stageId, assignedById, sourceId, createdAt }]

// Агрегированные данные для графиков
kpiData: {
    ;(totalLeads, revenue, conversionRate, avgDeal, trends)
}
sourceData: [{ name, percent, color }]
timeSeriesData: [{ month, google, facebook, linkedin }]
funnelData: [{ stage, percent, deals, revenue, color }]
stageListData: [{ name, count, revenue, color }]
```

---

## Компоненты (файловая структура)

```
src/
├── App.tsx                          ← главный компонент (заменяем целиком)
├── data/
│   └── mockData.ts                  ← все моковые данные
└── components/
    └── dashboard/
        ├── Navbar.tsx               ← шапка с логотипом
        ├── FilterBar.tsx            ← фильтры (дата, менеджер, источник)
        ├── KpiCard.tsx              ← карточка KPI с трендом
        ├── LeadsBySourceChart.tsx   ← горизонтальные прогресс-бары (без recharts)
        ├── LeadsOverTimeChart.tsx   ← line chart (recharts LineChart)
        ├── SalesFunnelChart.tsx     ← вертикальные столбцы по этапам (recharts BarChart)
        ├── DealsByStage.tsx         ← список этапов с суммами
        └── DealsTable.tsx           ← таблица сделок с Badge + Avatar + пагинацией
```

---

## shadcn компоненты

Уже установлены: `Card`, `Button`, `Select`, `ChartContainer` (recharts wrapper)

Нужно добавить через `npx shadcn add`:

- `badge` — статус этапа в таблице
- `avatar` — аватар менеджера в таблице
- `table` — таблица сделок

Остальное — кастомная верстка на Tailwind.

---

## Детали по секциям

### 1. Navbar

- Лого: иконка `bar-chart-3` (lucide) в indigo-квадрате + текст "CRM Аналитика"
- Правая часть: иконка `bell` + Avatar (инициалы "JD")

### 2. FilterBar

- `Select` для даты: "1 янв — 31 мар 2026"
- `Select` для менеджера: "Все менеджеры"
- `Select` для источника: "Все источники"
- Кнопка ghost "Сбросить фильтры"

### 3. KPI Cards (4 штуки)

| Метрика     | Значение | Тренд                          |
| ----------- | -------- | ------------------------------ |
| Всего лидов | 12 486   | +12.5% (зелёный, trending-up)  |
| Выручка     | $2.4M    | +8.3% (зелёный, trending-up)   |
| Конверсия   | 24.8%    | +3.2% (зелёный, trending-up)   |
| Средний чек | $18 540  | -2.1% (красный, trending-down) |

### 4. Источники лидов (горизонтальный bar chart)

Кастомная верстка: label + прогресс-трек + залитая полоса с процентом.

| Источник       | %   | Цвет    |
| -------------- | --- | ------- |
| Реклама Google | 34% | #4f46e5 |
| Facebook       | 26% | #06b6d4 |
| LinkedIn       | 22% | #f59e0b |
| Эл. почта      | 12% | #8b5cf6 |
| Рефералы       | 6%  | #ec4899 |

### 5. Лиды во времени (line chart)

- Tabs: День / Неделя / Месяц
- 3 линии: Google (#4f46e5), Facebook (#06b6d4), LinkedIn (#f59e0b)
- X-ось: Янв, Фев, Мар, Апр, Май, Июн
- Реализация: `recharts` LineChart через shadcn `ChartContainer`

### 6. Воронка продаж (вертикальные столбцы)

- 6 этапов с двумя столбцами (сделки + выручка) в каждом
- Высота пропорциональна проценту: 100% → 180px, 14% → 25px
- Реализация: кастомная верстка с flex колонками

| Этап     | %    | Цвет    |
| -------- | ---- | ------- |
| Новый    | 100% | #4f46e5 |
| Квалиф.  | 68%  | #06b6d4 |
| Предл.   | 42%  | #f59e0b |
| Перег.   | 28%  | #8b5cf6 |
| Выиграно | 18%  | #16a34a |
| Потеряно | 14%  | #dc2626 |

### 7. Сделки по этапам (список)

Список строк: цветная точка + название этапа + кол-во сделок + выручка

### 8. Таблица сделок

Колонки: Название сделки | Этап (Badge) | Менеджер (Avatar + имя) | Источник | Сумма | Создано

Badge цвета по этапу:

- Квалификация → синий
- Выиграно → зелёный
- Предложение → жёлтый
- Переговоры → фиолетовый
- Потеряно → красный

Пагинация: "Показано 1-6 из 243" + кнопки < >

---

## Порядок реализации

1. Установить недостающие shadcn компоненты (`badge`, `avatar`, `table`)
2. Создать `src/data/mockData.ts`
3. Создать компоненты в порядке сверху вниз:
    - `Navbar.tsx`
    - `FilterBar.tsx`
    - `KpiCard.tsx`
    - `LeadsBySourceChart.tsx`
    - `LeadsOverTimeChart.tsx`
    - `SalesFunnelChart.tsx`
    - `DealsByStage.tsx`
    - `DealsTable.tsx`
4. Собрать всё в `App.tsx`
5. Проверить в браузере

---

## Технические решения

- Все стили через Tailwind CSS (цвета через inline-стили только для динамических HEX из данных)
- `ChartContainer` + `LineChart` из recharts для "Лиды во времени"
- Воронка и источники — кастомная верстка без recharts (как в дизайне)
- State для фильтров: `useState` в `FilterBar` (позже заменить на реальный API)
- State для активного таба в line chart: День/Неделя/Месяц
- Шрифт: Inter (подключён через Tailwind/CSS)
